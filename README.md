immutable-ops
===============

[![NPM package](https://img.shields.io/npm/v/immutable-ops.svg?style=flat-square)](https://www.npmjs.com/package/immutable-ops)
![GitHub Release Date](https://img.shields.io/github/release-date/tommikaikkonen/immutable-ops.svg?style=flat-square)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/immutable-ops.svg?style=flat-square)
[![NPM downloads](https://img.shields.io/npm/dm/immutable-ops.svg?style=flat-square)](https://www.npmjs.com/package/immutable-ops)
![NPM license](https://img.shields.io/npm/l/immutable-ops.svg?style=flat-square)

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
npm install immutable-ops --save
```

## Example Usage

```javascript
import compose from 'ramda/src/compose';
import ops from 'immutable-ops';

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

    // Placeholder for currying.
    __,
} = ops;

const arr = [1, 2, 3];

const pushFour = ops.push(4);
const pushFive = ops.push(5);

// All functions are curried. These functions
// still need the final argument, the array to
// operate on.
expect(pushFive).to.be.a('function');

const pushFourAndFive = compose(pushFive, pushFour);

const result = pushFourAndFive(arr);
// Two new arrays were created during `pushFourAndFive` execution.
expect(result).to.deep.equal([1, 2, 3, 4, 5]);



// Only one new array is created.
const sameResult = ops.batched(batchedOps => {
    // batchedOps is able to keep track of mutated
    // objects.
    return compose(
        batchedOps.push(5),
        batchedOps.push(4)
    )(arr);
});

expect(sameResult).to.deep.equal([1, 2, 3, 4, 5]);
```

## Batched Mutations

A batch token is supplied by the user at the start of a batch, or created by `immutable-ops`. Each newly created object within a batch is tagged with that token. If a batch using token `X` operates on an object that is tagged with token `X`, it is free to mutate it. You can think of it as an ownership; the batch owns the newly created object and therefore is free to mutate it. New batches use a token `Y` that will never be equal to the previous token.

Tags are not removed; They are assigned to a non-enumerable property `@@_______immutableOpsOwnerID` which should avoid any collisions.

This token strategy is similar to what ImmutableJS uses to track batches.

**Manually using batch tokens**

`ops.batch` gives you access to all the `immutable-ops` functions that take a token as their additional first argument. Otherwise they are identical to the functions found in `ops` directly.

```javascript
import ops from 'immutable-ops';
const token = ops.getBatchToken();

// This object has no batch token, since it was not created by immutable-ops.
const obj = {a: 1, b: 2};

// obj2 is a newly created object tagged with the token.
const obj2 = ops.batch.set(token, 'a', 10, obj);
expect(obj).to.not.equal(obj2)

// Because we operate on obj2 that has the same token as
// we passed to the function, obj2 is mutated.
const obj3 = ops.batch.set(token, 'b', 20, obj2);
expect(obj2).to.equal(obj3);
```


**Handling batch tokens implicitly**

```javascript
import ops from 'immutable-ops';

const obj = {a: 1, b: 2};

const obj3 = ops.batched(batchedOps => {
    // batchedOps has functions that are bound to a new batch token.
    const obj2 = batchedOps.set('a', 10, obj);
    return batchedOps.set('b', 20, obj2);
});
```

## Currying

All operations are curried by default. Functions are curried with `ramda.curry`. In addition to normal currying behaviour, you can use the `ramda` placeholder variable available in `ops.__` to specify parameters you want to pass arguments for later. Example:

```javascript
const removeNFromHead = ops.splice(/* startIndex */ 0, /* deleteCount */ops.__, /* valsToAdd */[]);
const removeTwoFromHead = removeNFromHead(2);
const arr = [1, 2, 3];

console.log(removeTwoFromHead(arr));
// [3];
```

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

## Changelog

## 0.5.0: Major Changes

- **BREAKING**: No `getImmutableOps` function, which was the main export, is exported anymore because options were removed. Now the object containing the operation functions is exported directly.
- **BREAKING**: removed option to choose whether operations are curried. Functions are now always curried.
- **BREAKING**: former batched mutations API totally replaced.
- **BREAKING**: batched mutations implementation changed.
    
    Previously newly created objects were tagged with a "can mutate" tag, and references to those objects were kept in a list. After the batch was finished, the list was processed by removing the tags from each object in the list.

    Now a batch token is created at the start of a batch (or supplied by the user). Each newly created object is tagged with that token. If a batch using token `X` operates on an object that is tagged with token `X`, it is free to mutate it. New batches use a token `Y` that will never be equal to the previous token.

    Tags are not removed anymore; They are assigned to a non-enumerable property `@@_______immutableOpsOwnerID` which should avoid any collisions.

    This token strategy is similar to what ImmutableJS uses to track batches.

## License

MIT. See [`LICENSE`](https://github.com/tommikaikkonen/immutable-ops/blob/master/LICENSE).
