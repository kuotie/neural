# @kuotie/neural

This is the neural network implementation for Kuotie Conversational AI.

## Installation

```sh
npm i @kuotie/neural
```

## Usage

```javascript
const { Neural } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = new Neural();
net.train(corpus);
const output = net.run('who are you?');
console.log(output);
// [
//  { intent: 'smalltalk.acquaintance', score: 0.9994305864564091 },
//  { intent: 'smalltalk.annoying', score: 0.00029939905400927795 },
//  { intent: 'smalltalk.bad', score: 0.0002644902763842131 },
//  { intent: 'smalltalk.hungry', score: 0.000005524213197446476 }
//]
```

## Usage with functions
```javascript
const { train, run } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = train(corpus);
const output = run(net, 'who are you?');
console.log(output);
// [
//  { intent: 'smalltalk.acquaintance', score: 0.9994305864564091 },
//  { intent: 'smalltalk.annoying', score: 0.00029939905400927795 },
//  { intent: 'smalltalk.bad', score: 0.0002644902763842131 },
//  { intent: 'smalltalk.hungry', score: 0.000005524213197446476 }
//]
```

## Filter the intents
You can run the neural network, but filtering the intents that you're expecting.
This is very useful in multi-step conversations where you know what you're expecting.
One example: if you have 50 intents, and there is one intent for "yes" and other one for "no" and the conversation is expecting a yes/no from the user, then you can limit the intents to those two to don't have a false positive from another.

```javascript
const { train, run } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = train(corpus);
let output = run(net, 'who are');
console.log(output);
// [
//   { intent: 'smalltalk.acquaintance', score: 0.8898844550276465 },
//   { intent: 'support.developers', score: 0.10703765534906658 },
//   { intent: 'smalltalk.chatbot', score: 0.001117932794645858 },
//   { intent: 'smalltalk.besmart', score: 0.0010239828112562853 },
//   { intent: 'smalltalk.boring', score: 0.0009355357515508536 },
//   { intent: 'smalltalk.busy', score: 4.3826583404487236e-7 }
// ]
output = run(net, 'Who are', ['support.developers', 'support.contact', 'support.address']);
console.log(output);
// [ { intent: 'support.developers', score: 1 } ]
```

## Multi-intent detection

You can run the neural network in multi-intent mode. That means that from one sentence, it will try to identifiy if it's composed by several different sentences. 

In our test corpus we have an intent "smalltalk.acquaintance" for identifying utterances like "who are you", an intent "smalltalk.birthday" for identifying utterances like "when is your birthday" and an intent "smalltalk.boss" for identifying utterances like "who is your boss". What happen if we try to classify "who are you, when is your birthday and who is your boss?". In a mono-intent approach it will identify this sentence as being the intent "smalltalk.boss".
But we can set the option ```{ multi: true }``` when creating the Neural instance:

```javascript
const { Neural } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = new Neural({ multi: true });
net.train(corpus);
const output = run(net, 'who are you, when is your birthday and who is your boss');
console.log(output);
// {
//   "monoIntent": [
//     {
//       "intent": "smalltalk.boss",
//       "score": 0.7464177512679069
//     },
//     {
//       "intent": "smalltalk.birthday",
//       "score": 0.2535210691874059
//     },
//     {
//       "intent": "smalltalk.right",
//       "score": 0.00006117954468731187
//     }
//   ],
//   "multiIntent": [
//     {
//       "tokens": [
//         "who",
//         "are",
//         "you"
//       ],
//       "embeddings": [
//         36,
//         64,
//         28
//       ],
//       "classifications": [
//         {
//           "intent": "smalltalk.acquaintance",
//           "score": 0.9994305864564091
//         },
//         {
//           "intent": "smalltalk.annoying",
//           "score": 0.00029939905400927795
//         },
//         {
//           "intent": "smalltalk.bad",
//           "score": 0.0002644902763842131
//         },
//         {
//           "intent": "smalltalk.hungry",
//           "score": 0.000005524213197446476
//         }
//       ]
//     },
//     {
//       "tokens": [
//         "when",
//         "is",
//         "your",
//         "birthday",
//         "and"
//       ],
//       "embeddings": [
//         113,
//         8,
//         2,
//         114,
//         269
//       ],
//       "classifications": [
//         {
//           "intent": "smalltalk.birthday",
//           "score": 0.9874897374972665
//         },
//         {
//           "intent": "trivia.gc",
//           "score": 0.01251026250273345
//         }
//       ]
//     },
//     {
//       "tokens": [
//         "who",
//         "is",
//         "your",
//         "boss"
//       ],
//       "embeddings": [
//         36,
//         8,
//         2,
//         141
//       ],
//       "classifications": [
//         {
//           "intent": "smalltalk.boss",
//           "score": 0.9999821681183945
//         },
//         {
//           "intent": "support.developers",
//           "score": 0.000017831881605606757
//         }
//       ]
//     }
//   ]
// }
```

## Measure

Neural comes with a method to measure the test utterances of a corpus and obtain how many tests are and how many are classified into the correct intent. In the corpus, for each intent, take a look into the "tests" of each intent, that will be the sentences validated by the masure method.

You can measure the tests of the corpus already provided to train:

```javascript
const { Neural } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = new Neural();
net.train(corpus);
const measures = net.measure();
console.log(measures);
// { good: 202, total 256 }
```

You can also measure providing the json of the corpus:

```javascript
const { Neural } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const net = new Neural();
net.train(corpus);
const measures = net.measure(corpus);
console.log(measures);
// { good: 202, total 256 }
```

## Processor

A processor is a function that given a sentence returns an array of features.
By default, the processor is a normalizer and a tokenizer, but you can provide your own classifiers.
In this example we will increase the precision of the neural network with the given corpus simply by removing the suffixes 'er', 'ers', 'ing', 'ed' and 'ment':

```javascript
const { normalize, tokenize } = require('@kuotie/core');
const { Neural } = require('@kuotie/neural');
const corpus = require('@kuotie/neural/test/corpus-en.json');

const suffixes = ['er', 'ers', 'ing', 'ed', 'ment'];
const stem = (x) => x.map(y => {
  for (let i = 0; i < suffixes.length; i += 1) {
    if (y.endsWith(suffixes[i])) {
      return y.slice(0, -suffixes[i].length);
    }
  }
  return y;
});

const processor = text => stem(tokenize(normalize(text)));
const net = new Neural({ processor });
net.train(corpus);
const measures = net.measure();
console.log(measures);
// { good: 218, total 256 }

```

## Corpus example

```json
{
    "name": "Corpus 50",
    "locale": "en-US",
    "data": [
      {
        "intent": "smalltalk.acquaintance",
        "utterances": [
          "say about you",
          "tell me about your personality",
          "talk about yourself",
          "what is your personality",
          "who are you"
        ],
        "tests": [
          "talk me about you",
          "say something about you",
          "speak about your personality",
          "tell me all about you",
          "what are you"
        ]
      },
      {
        "intent": "smalltalk.birthday",
        "utterances": [
          "when is your birthday",
          "when were you born",
          "tell me your birthday",
          "when you celebrate your birth",
          "can you say your birthday"
        ],
        "tests": [
          "please tell me about your birthday",
          "when you were borned?",
          "when did your birth happen?",
          "you have a birth celebration?",
          "talk about your birthday"
        ]
      }
    ]
}
```
