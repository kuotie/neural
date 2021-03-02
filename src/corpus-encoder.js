class CorpusEncoder {
  constructor(settings = {}) {
    this.processor = settings.processor;
    this.featureMap = new Map();
    this.features = [];
    this.unknownIndex = settings.unknownIndex;
    this.intentMap = new Map();
    this.intents = [];
  }

  addFeature(feature) {
    if (!this.featureMap.has(feature)) {
      this.featureMap.set(feature, this.features.length);
      this.features.push(feature);
    }
  }

  addIntent(intent) {
    if (!this.intentMap.has(intent)) {
      this.intentMap.set(intent, this.intents.length);
      this.intents.push(intent);
    }
  }

  addFeatureIntent(feature, intent) {
    this.addFeature(feature);
    this.addIntent(intent);
  }

  getFeatureIndex(feature) {
    return this.featureMap.get(feature);
  }

  getFeature(index) {
    return this.features[index];
  }

  getIntentIndex(intent) {
    return this.intentMap.get(intent);
  }

  getIntent(index) {
    return this.intents[index];
  }

  processText(text, intent, learn = false) {
    const result = { data: {}, keys: [] };
    const feats = this.processor ? this.processor(text) : text;
    for (let i = 0; i < feats.length; i += 1) {
      const feature = feats[i];
      if (learn) {
        this.addFeatureIntent(feature, intent);
      }
      let index = this.getFeatureIndex(feature);
      if (index === undefined) {
        index = this.unknownIndex;
      }
      if (index !== undefined) {
        if (result.data[index] === undefined) {
          result.data[index] = 1;
          result.keys.push(index);
        }
      }
    }
    return result;
  }

  processTextFull(text) {
    const result = { data: {}, keys: [] };
    const feats = this.processor ? this.processor(text) : text;
    for (let i = 0; i < feats.length; i += 1) {
      const feature = feats[i];
      let index = this.getFeatureIndex(feature);
      if (index === undefined) {
        index = this.unknownIndex;
      }
      if (index !== undefined) {
        result.data[index] = 1;
        result.keys.push(index);
      }
    }
    return result;
  }

  processIntent(intent) {
    const index = this.getIntentIndex(intent);
    return {
      data: { [index]: 1 },
      keys: [index],
    };
  }

  process(text, intent, learn = true) {
    const input = this.processText(text, intent, learn);
    const output = this.processIntent(intent);
    return { input, output };
  }

  run(corpus) {
    const result = { train: [], validation: [] };
    for (let i = 0; i < corpus.length; i += 1) {
      const item = corpus[i];
      for (let j = 0; j < item.utterances.length; j += 1) {
        const utterance = item.utterances[j];
        const { intent } = item;
        const processed = this.process(utterance, intent);
        result.train.push(processed);
        if (this.onTrainUtterance) {
          this.onTrainUtterance(utterance, intent, processed);
        }
      }
    }
    for (let i = 0; i < corpus.length; i += 1) {
      const item = corpus[i];
      if (item.tests) {
        for (let j = 0; j < item.tests.length; j += 1) {
          result.validation.push(
            this.process(item.tests[j], item.intent, false)
          );
        }
      }
    }
    return result;
  }

  toJSON() {
    return {
      features: [...this.features],
      intents: [...this.intents],
      unknownIndex: this.unknownIndex,
    };
  }

  fromJSON(json) {
    this.featureMap = new Map();
    this.features = [];
    this.unknownIndex = json.unknownIndex;
    this.intentMap = new Map();
    this.intents = [];
    json.features.forEach((feature) => this.addFeature(feature));
    json.intents.forEach((intent) => this.addIntent(intent));
  }
}

module.exports = CorpusEncoder;
