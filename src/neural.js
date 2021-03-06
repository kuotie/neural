const { normalize, tokenize } = require('@kuotie/core');
const CorpusEncoder = require('./corpus-encoder');

const defaultSettings = {
  iterations: 20000,
  errorThresh: 0.00005,
  deltaErrorThresh: 0.000001,
  learningRate: 0.6,
  momentum: 0.5,
  alpha: 0.07,
  log: false,
  multi: false,
  processor: (text) => tokenize(normalize(text)),
};

class Neural {
  constructor(settings = {}) {
    this.applySettings(settings, defaultSettings);
    if (this.settings.log === true) {
      this.logFn = (status, time) =>
        console.log(
          `Epoch ${status.iterations} loss ${status.error} time ${time}ms`
        );
    } else if (typeof this.settings.log === 'function') {
      this.logFn = this.settings.log;
    }
  }

  applySettings(srcobj = {}, settings = {}) {
    this.settings = { ...srcobj };
    Object.keys(settings).forEach((key) => {
      if (this.settings[key] === undefined) {
        this.settings[key] = settings[key];
      }
    });
  }

  prepareCorpus(corpus) {
    this.encoder = new CorpusEncoder({ processor: this.settings.processor });
    if (this.onTrainUtterance) {
      this.encoder.onTrainUtterance = this.onTrainUtterance;
    }
    this.encoded = this.encoder.run(corpus);
  }

  initialize() {
    const labels = this.encoder.intents;
    const numFeatures = this.encoder.features.length;
    this.perceptrons = [];
    this.perceptronsByName = {};
    this.numPerceptrons = labels.length;
    for (let i = 0; i < labels.length; i += 1) {
      const name = labels[i];
      const perceptron = {
        name,
        id: i,
        weights: new Float32Array(numFeatures),
        changes: new Float32Array(numFeatures),
        bias: 0,
      };
      this.perceptrons.push(perceptron);
      this.perceptronsByName[name] = perceptron;
    }
  }

  runInputPerceptronTrain(perceptron, input) {
    const sum = input.keys.reduce(
      (prev, key) => prev + input.data[key] * perceptron.weights[key],
      perceptron.bias
    );
    return sum <= 0 ? 0 : this.settings.alpha * sum;
  }

  runInputPerceptron(perceptron, input) {
    const sum = input.keys.reduce(
      (prev, key) => prev + input.data[key] * perceptron.weights[key],
      perceptron.bias
    );
    return sum <= perceptron.bias ? 0 : this.settings.alpha * sum;
  }

  runInputPerceptronMulti(perceptron, input, keys) {
    let sum = perceptron.bias;
    const visited = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!visited[key]) {
        visited[key] = 1;
        sum += input.data[key] * perceptron.weights[key];
      }
    }
    return sum <= perceptron.bias ? 0 : this.settings.alpha * sum;
  }

  runInputMulti(input, keys, validIntents) {
    const outputs = [];
    let total = 0;
    if (validIntents) {
      for (let i = 0; i < validIntents.length; i += 1) {
        const perceptron = this.perceptronsByName[validIntents[i]];
        const score = this.runInputPerceptronMulti(perceptron, input, keys);
        if (score > 0) {
          const item = { intent: perceptron.name, score };
          outputs.push(item);
          total += item.score;
        }
      }
    } else {
      for (let i = 0; i < this.numPerceptrons; i += 1) {
        const perceptron = this.perceptrons[i];
        const score = this.runInputPerceptronMulti(perceptron, input, keys);
        if (score > 0) {
          const item = { intent: perceptron.name, score };
          outputs.push(item);
          total += item.score;
        }
      }
    }
    if (total > 0) {
      return outputs.sort((a, b) => b.score - a.score);
    }
    return [{ intent: 'None', score: 1 }];
  }

  runInput(input, validIntents) {
    const outputs = [];
    let total = 0;
    if (validIntents) {
      for (let i = 0; i < validIntents.length; i += 1) {
        const perceptron = this.perceptronsByName[validIntents[i]];
        const score = this.runInputPerceptron(perceptron, input);
        if (score > 0) {
          const item = { intent: perceptron.name, score: score ** 2 };
          outputs.push(item);
          total += item.score;
        }
      }
    } else {
      for (let i = 0; i < this.numPerceptrons; i += 1) {
        const perceptron = this.perceptrons[i];
        const score = this.runInputPerceptron(perceptron, input);
        if (score > 0) {
          const item = { intent: perceptron.name, score: score ** 2 };
          outputs.push(item);
          total += item.score;
        }
      }
    }
    if (total > 0) {
      for (let i = 0; i < outputs.length; i += 1) {
        outputs[i].score /= total;
      }
      return outputs.sort((a, b) => b.score - a.score);
    }
    return [{ intent: 'None', score: 1 }];
  }

  runCached(input, keys, cache = {}) {
    const strKey = keys.join('-');
    let result = cache[strKey];
    if (!result) {
      result = this.runInputMulti(input, keys);
      cache[strKey] = result;
    }
    return result;
  }

  static calculateScore(input) {
    return input.length === 1
      ? input[0].score
      : input[0].score ** 2 - input[1].score ** 2;
  }

  getBestBinarySlices(data, keys, cache = {}) {
    const input = { data, keys };
    const runOne = this.runCached(input, keys, cache);
    let bestScore = Neural.calculateScore(runOne);
    let best = [keys];
    let runs = [runOne];
    for (let i = 1; i < keys.length; i += 1) {
      const left = keys.slice(0, i);
      const right = keys.slice(i);
      const runLeft = this.runCached(input, left, cache);
      const runRight = this.runCached(input, right, cache);
      const scoreLeft = Neural.calculateScore(runLeft);
      const scoreRight = Neural.calculateScore(runRight);
      const score = (scoreLeft + scoreRight) / 2;
      if (
        score > bestScore &&
        runLeft[0].score > 0.5 &&
        runRight[0].score > 0.5 &&
        runLeft[0].intent !== 'None' &&
        runRight[0].intent !== 'None'
      ) {
        bestScore = score;
        best = [left, right];
        runs = [runLeft, runRight];
      }
    }
    return best.length === 1
      ? [{ tokens: best[0], run: runs[0] }]
      : [
          { tokens: best[0], run: runs[0] },
          { tokens: best[1], run: runs[1] },
        ];
  }

  getBestSlices(data, keys, cache = {}) {
    const slices = this.getBestBinarySlices(data, keys, cache);
    if (slices.length === 1) {
      return slices;
    }
    const left = this.getBestSlices(data, slices[0].tokens, cache);
    const right = this.getBestSlices(data, slices[1].tokens, cache);
    return [...left, ...right];
  }

  static normalizeOutput(arr) {
    let total = 0;
    for (let i = 0; i < arr.length; i += 1) {
      const score = arr[i].score ** 2;
      total += score;
      arr[i].score = score;
    }
    if (total > 0) {
      for (let i = 0; i < arr.length; i += 1) {
        arr[i].score /= total;
      }
    }
  }

  static normalizeSlices(slices) {
    for (let i = 0; i < slices.length; i += 1) {
      Neural.normalizeOutput(slices[i].classifications);
    }
    return slices;
  }

  run(text, validIntents) {
    const result = this.runInput(this.encoder.processText(text), validIntents);
    if (!this.settings.multi) {
      return result;
    }
    const tokens = this.encoder.processTextFull(text);
    const slices = this.getBestSlices(tokens.data, tokens.keys);
    let total = 0;
    for (let i = 0; i < slices.length; i += 1) {
      const stems = [];
      const slice = slices[i];
      for (let j = 0; j < slice.tokens.length; j += 1) {
        stems.push(this.encoder.features[slice.tokens[j]]);
      }
      slice.embeddings = slice.tokens;
      slice.tokens = stems;
      slice.classifications = slice.run;
      total += slice.classifications[0].score;
      delete slice.run;
    }
    if (total / slices.length < result[0].score) {
      return {
        monoIntent: result,
        multiIntent: [slices],
      };
    }
    return {
      monoIntent: result,
      multiIntent: Neural.normalizeSlices(slices),
    };
  }

  trainPerceptron(perceptron, data) {
    const { alpha, momentum } = this.settings;
    const { changes, weights } = perceptron;
    let error = 0;
    for (let i = 0; i < data.length; i += 1) {
      const { input, output } = data[i];
      const actualOutput = this.runInputPerceptronTrain(perceptron, input);
      const expectedOutput = output.data[perceptron.id] || 0;
      const currentError = expectedOutput - actualOutput;
      if (currentError) {
        error += currentError ** 2;
        const delta =
          (actualOutput > 0 ? 1 : alpha) *
          currentError *
          this.decayLearningRate;
        for (let j = 0; j < input.keys.length; j += 1) {
          const key = input.keys[j];
          const change = delta * input.data[key] + momentum * changes[key];
          changes[key] = change;
          weights[key] += change;
        }
        perceptron.bias += delta;
      }
    }
    return error;
  }

  train(corpus) {
    if (corpus) {
      const srcData = Array.isArray(corpus) ? corpus : corpus.data;
      if (!srcData || !srcData.length) {
        throw new Error('Invalid corpus received');
      }
      this.prepareCorpus(srcData);
      this.initialize();
    }
    const data = this.encoded ? this.encoded.train : undefined;
    if (!data) {
      throw new Error('No corpus received');
    }
    if (!this.status) {
      this.status = { error: Infinity, deltaError: Infinity, iterations: 0 };
    }
    const minError = this.settings.errorThresh;
    const minDelta = this.settings.deltaErrorThresh;
    while (
      this.status.iterations < this.settings.iterations &&
      this.status.error > minError &&
      this.status.deltaError > minDelta
    ) {
      const hrstart = new Date();
      this.status.iterations += 1;
      this.decayLearningRate =
        this.settings.learningRate / (1 + 0.001 * this.status.iterations);
      const lastError = this.status.error;
      this.status.error = 0;
      for (let i = 0; i < this.numPerceptrons; i += 1) {
        this.status.error += this.trainPerceptron(this.perceptrons[i], data);
      }
      this.status.error /= this.numPerceptrons * data.length;
      this.status.deltaError = Math.abs(this.status.error - lastError);
      const hrend = new Date();
      if (this.logFn) {
        this.logFn(this.status, hrend.getTime() - hrstart.getTime());
      }
    }
    return this.status;
  }

  measureCorpus(corpus) {
    let total = 0;
    let good = 0;
    for (let i = 0; i < corpus.data.length; i += 1) {
      const item = corpus.data[i];
      for (let j = 0; j < item.tests.length; j += 1) {
        const test = item.tests[j];
        const output = this.run(test);
        total += 1;
        const intent = Array.isArray(output) ? output[0].intent : output.intent;
        if (intent === item.intent) {
          good += 1;
        }
      }
    }
    return { good, total };
  }

  measure(corpus) {
    if (corpus) {
      return this.measureCorpus(corpus);
    }
    if (!this.encoded.validation || !(this.encoded.validation.length > 0)) {
      throw new Error('No corpus provided to measure');
    }
    let total = 0;
    let good = 0;
    for (let i = 0; i < this.encoded.validation.length; i += 1) {
      total += 1;
      const { input, output } = this.encoded.validation[i];
      const actual = this.runInput(input);
      const expectedIntent = this.encoder.getIntent(output.keys[0]);
      const actualIntent = actual[0].intent;
      if (expectedIntent === actualIntent) {
        good += 1;
      }
    }
    return { good, total };
  }

  toJSON(options = {}) {
    const result = {
      settings: { ...this.settings },
    };
    delete result.settings.processor;
    if (this.perceptrons) {
      result.perceptrons = [];
      for (let i = 0; i < this.perceptrons.length; i += 1) {
        const perceptron = this.perceptrons[i];
        const current = {
          name: perceptron.name,
          id: perceptron.id,
          weights: [...perceptron.weights],
          bias: perceptron.bias,
        };
        if (options.saveChanges) {
          current.changes = [...perceptron.changes];
        }
        result.perceptrons.push(current);
      }
      if (options.saveEncoder !== false) {
        result.encoder = this.encoder.toJSON();
      }
    }
    return result;
  }

  fromJSON(json) {
    this.settings = { ...this.settings, ...json.settings };
    if (json.encoder) {
      this.encoder = new CorpusEncoder({ processor: this.settings.processor });
      this.encoder.fromJSON(json.encoder);
    }
    if (json.perceptrons) {
      this.initialize();
      for (let i = 0; i < json.perceptrons.length; i += 1) {
        const perceptron = json.perceptrons[i];
        const current = this.perceptronsByName[perceptron.name];
        current.bias = perceptron.bias;
        for (let j = 0; j < perceptron.weights.length; j += 1) {
          current.weights[j] = perceptron.weights[j];
        }
        if (perceptron.changes) {
          for (let j = 0; j < perceptron.changes.length; j += 1) {
            current.changes[j] = perceptron.changes[j];
          }
        }
      }
    }
  }
}

module.exports = Neural;
