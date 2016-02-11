immutable-ops
===============

A collection of functions to perform immutable operations on plain JavaScript objects and arrays.

Like [updeep](https://github.com/substantial/updeep) but with batched mutations and no freezing.

Like [icepick](https://github.com/aearly/icepick), but with batched mutations and a curried API that puts the target object as the last argument. No freezing.

## Features

- Small. It's just 10 functions.
- Functional API with curried functions
- JavaScript in, JavaScript out
- Batched mutations

## Installation

```bash
npm install immutable-ops
```

## Example Usage

```javascript
import compose from 'ramda/src/compose';
import getOps from 'immutable-ops';

// These are all the available functions.
const {
    // Functions operating on objects.
    merge,
    mergeDeep,
    omit,
    setIn,

    // Functions operating on arrays.
    insert,
    splice,
    push,
    filter,

    // Functions operating on both
    set,

    // Batch mutations
    batched,
    
    // Placeholder for currying.
    __,
} = getOps({
    // These are the default options.
    curried: true
});

const arr = [1, 2, 3];

const pushFour = ops.push(4);
const pushFive = ops.push(5);

// All functions are curried. These functions
// still need the final argument, the array to
// operate on.
expect(pushFive).to.be.a('function');

const pushFourAndFive = compose(pushFive, pushFour);

const result = pushFourAndFive(arr);
// Two new arrays were created during `pushFourAndFive` eecution.
expect(result).to.deep.equal([1, 2, 3, 4, 5]);

const batchedPushFourAndFive = ops.batch(pushFourAndFive);

const sameResult = batchedPushFourAndFive(arr);
// Only one new array is created during `batchedPushFourAndFive` execution.
// `immutable-ops` keeps track of objects mutated during the wrapped
// function, and applies the same operations with mutations to those objects. 
expect(result).to.deep.equal([1, 2, 3, 4, 5]);
```

## Batched Mutations

You can run operations in a mutation batch by calling `ops.batched(func)` with a function, and you can create a batch-wrapped function with `const batchedFunc = ops.batch(funcToWrap)`.

When `immutable-ops` creates a new object or array during batched mutations to preserve immutability, it tags it as a mutable object (by adding an unenumerable `@@_____canMutate` property) and pushes its reference to an array of `mutatedObjects`. All consecutive functions applied will execute a mutating operations for objects that have the tag. This applies for tagged objects found in nested structures too.

When the function finishes executing, `immutable-ops` loops through the `mutatedObjects` array, removing the tag properties from each object, and clearing the `mutatedObjects` array.

The overhead of keeping track of mutated objects should be a sufficient tradeoff to creating lots of new objects to applyi multiple consecutive operations, unless you're working on a really big set of data.

## Currying

All operations are curried by default. If you don't want them to be curried, pass `{ curried: false }` to `getImmutableOps()`. Functions are curried with `ramda.curry`. In addition to normal currying behaviour, you can use the `ramda` placeholder variable available in `ops.__` to specify parameters you want to pass arguments for later. Example:

```javascript
const removeNFromHead = ops.splice(/* startIndex */ 0, /* deleteCount */ops.__, /* valsToAdd */[]);
const removeTwoFromHead = removeNFromHead(2);
const arr = [1, 2, 3];

console.log(removeTwoFromHead(arr));
// [3];
```

## Batched Mutations API

### batched(functionToRun)

Executes `functionToRun` as a batched mutation and returns the return value of `functionToRun`.`functionToRun` will be called without arguments. During `functionToRun` execution, `immutable-ops` will keep track of new objects created during operations, and apply further operations with mutations to those objects. 

### batch(functionToWrap)

Like `batched`, but returns a function that wraps `functionToWrap` to be executed as a batch. `functionToWrap` is also curried. When `functionToWrap` is executed (all arguments are passed), all operations run during its execution will apply mutations instead of creating new objects whenever possible.

## Object API

### merge(mergeObj, targetObj)

Performs a shallow merge on `targetObj`. `mergeObj` can be a single object to merge, or a list of objects. If a list is passed as `mergeObj`, objects to the right in the list will have priority when determining final attributes.

Returns the merged object, which will be a different object if an actual change was detected during the merge.

```javascript
const result = ops.merge(
    // mergeObj
    {
        a: 'theA',
        b: {
            c: 'nestedC',
        },
    },
    // targetObj
    {
        a: 'theA2',
        b: {
            d: 'nestedD',
        },
        c: 'theC',
    }
);

console.log(result);
// {
//     {
//         a: 'theA',
//         b: {
//             c: 'nestedC'
//         },
//         c: 'theC',
//     },
// }
```

### deepMerge(mergeObj, targetObj)

Same as `merge`, but performs `merge` recursively on attributes that are objects (not arrays).

```javascript
const result = ops.deepMerge(
    // mergeObj
    {
        a: 'theA',
        b: {
            c: 'nestedC',
        },
    },
    // targetObj
    {
        a: 'theA2',
        b: {
            d: 'nestedD',
        },
        c: 'theC',
    }
);

console.log(result);
// {
//     {
//         a: 'theA',
//         b: {
//             c: 'nestedC',
//             d: 'nestedD',
//         },
//         c: 'theC',
//     },
// }
```

### setIn(path, value, targetObj)

Returns an object, with the value at `path` set to `value`. `path` can be a dot-separated list of attribute values or an array of attribute names to traverse.

```javascript

const obj = {
    location: {
        city: 'San Francisco',
    },
};

const newObj = ops.setIn(['location', 'city'], 'Helsinki', obj);
console.log(newObj);
// {
//     location: {
//         city: 'Helsinki',
//     },
// };
```

### omit(keysToOmit, targetObj)

Returns a shallow copy of `targetObj` without the keys specified in `keysToOmit`. `keysToOmit` can be a single key name or an array of key names.

```javascript
const obj = {
    a: true,
    b: true,
};

const result = ops.omit('a', obj);

console.log(result);
// {
//     b: true,
// }
```

## Array API

### insert(startIndex, values, targetArray)

Returns a new array with `values` inserted at starting at index `startIndex` to `targetArray`.

```javascript
const arr = [1, 2, 4];
const result = ops.insert(2, [3], arr);
console.log(result);
// [1, 2, 3, 4]
```

### push(value, targetArray)

Returns a shallow copy of `targetArray` with `value` added to the end. `value` can be a single value or an array of values to push.

```javascript
const arr = [1, 2, 3];
const result = ops.push(4, arr);
console.log(result);
// [1, 2, 3, 4]
```

### filter(func, targetArray)

Returns a shallow copy of `targetArray` with items that `func` returns `true` for, when calling it with the item.

```javascript
const arr = [1, 2, 3, 4];
const result = ops.filter(item => item % 2 === 0, arr);
console.log(result);
// [2, 4]
```

### splice(startIndex, deleteCount, values, targetArray)

Like `Array.prototype.splice`, but operates on a shallow copy of `targetArray` and returns the shallow copy.

```javascript
const arr = [1, 2, 3, 3, 3, 4];
const result = ops.splice(2, 2, [], arr);
console.log(result);
// [1, 2, 3, 4]
```

## API for both Object and Array

### set(key, value, target)

Returns a shallow copy of `target` with its value at index or key `key` set to `value`.

```javascript
const arr = [1, 2, 5];
const result = ops.set(2, 3, arr);
console.log(result);
// [1, 2, 3]

const obj = {
    a: 'X',
    b: 'theB',
};
const resultObj = ops.set('a', 'theA', obj);
console.log(resultObj);
// {
//     a: 'theA',
//     b: 'theB',
// }
```

## License

MIT. See `LICENSE`
