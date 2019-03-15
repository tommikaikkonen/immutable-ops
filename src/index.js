import { curry, __ as placeholder } from 'ramda';

function forOwn(obj, fn) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            fn(obj[key], key);
        }
    }
}

function isArrayLike(value) {
    return value
        && typeof value === 'object'
        && typeof value.length === 'number'
        && value.length >= 0
        && value.length % 1 === 0;
}

const OWNER_ID_TAG = '@@_______immutableOpsOwnerID';

function fastArrayCopy(arr) {
    const copied = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        copied[i] = arr[i];
    }
    return copied;
}

export function canMutate(obj, ownerID) {
    if (!ownerID) return false;
    return obj[OWNER_ID_TAG] === ownerID;
}

const newOwnerID = typeof Symbol === 'function'
    ? () => Symbol('ownerID')
    : () => ({});

export const getBatchToken = newOwnerID;

function addOwnerID(obj, ownerID) {
    Object.defineProperty(obj, OWNER_ID_TAG, {
        value: ownerID,
        configurable: true,
        enumerable: false,
    });

    return obj;
}

function prepareNewObject(instance, ownerID) {
    if (ownerID) {
        addOwnerID(instance, ownerID);
    }
    return instance;
}

function forceArray(arg) {
    if (!(arg instanceof Array)) {
        return [arg];
    }
    return arg;
}

const PATH_SEPARATOR = '.';

function normalizePath(pathArg) {
    if (typeof pathArg === 'string') {
        if (pathArg.indexOf(PATH_SEPARATOR) === -1) {
            return [pathArg];
        }
        return pathArg.split(PATH_SEPARATOR);
    }

    return pathArg;
}

function mutableSet(key, value, obj) {
    obj[key] = value;
    return obj;
}

function mutableSetIn(_pathArg, value, obj) {
    const originalPathArg = normalizePath(_pathArg);

    const pathLen = originalPathArg.length;

    let done = false;
    let idx = 0;
    let acc = obj;
    let curr = originalPathArg[idx];

    while (!done) {
        if (idx === pathLen - 1) {
            acc[curr] = value;
            done = true;
        } else {
            const currType = typeof acc[curr];

            if (currType === 'undefined') {
                const newObj = {};
                prepareNewObject(newObj, null);
                acc[curr] = newObj;
            } else if (currType !== 'object') {
                const pathRepr = `${originalPathArg[idx - 1]}.${curr}`;
                throw new Error(
                    `A non-object value was encountered when traversing setIn path at ${pathRepr}.`
                );
            }
            acc = acc[curr];
            idx++;
            curr = originalPathArg[idx];
        }
    }

    return obj;
}

function valueInPath(_pathArg, obj) {
    const pathArg = normalizePath(_pathArg);

    let acc = obj;
    for (let i = 0; i < pathArg.length; i++) {
        const curr = pathArg[i];
        const currRef = acc[curr];
        if (i === pathArg.length - 1) {
            return currRef;
        }

        if (typeof currRef === 'object') {
            acc = currRef;
        } else {
            return undefined;
        }
    }
    return undefined;
}

function immutableSetIn(ownerID, _pathArg, value, obj) {
    const pathArg = normalizePath(_pathArg);

    const currentValue = valueInPath(pathArg, obj);
    if (value === currentValue) return obj;

    const pathLen = pathArg.length;

    let acc;
    if (canMutate(obj, ownerID)) {
        acc = obj;
    } else {
        acc = Object.assign(prepareNewObject({}, ownerID), obj);
    }

    const rootObj = acc;

    pathArg.forEach((curr, idx) => {
        if (idx === pathLen - 1) {
            acc[curr] = value;
            return;
        }

        const currRef = acc[curr];
        const currType = typeof currRef;

        if (currType === 'object') {
            if (canMutate(currRef, ownerID)) {
                acc = currRef;
            } else {
                const newObj = prepareNewObject({}, ownerID);
                acc[curr] = Object.assign(newObj, currRef);
                acc = newObj;
            }
            return;
        }

        if (currType === 'undefined') {
            const newObj = prepareNewObject({}, ownerID);
            acc[curr] = newObj;
            acc = newObj;
            return;
        }

        const pathRepr = `${pathArg[idx - 1]}.${curr}`;
        throw new Error(`A non-object value was encountered when traversing setIn path at ${pathRepr}.`);
    });

    return rootObj;
}

function mutableMerge(isDeep, _mergeObjs, baseObj) {
    const mergeObjs = forceArray(_mergeObjs);

    if (isDeep) {
        mergeObjs.forEach(mergeObj => {
            forOwn(mergeObj, (value, key) => {
                if (isDeep && baseObj.hasOwnProperty(key)) {
                    let assignValue;
                    if (typeof value === 'object') {
                        assignValue = mutableMerge(isDeep, [value], baseObj[key]);
                    } else {
                        assignValue = value;
                    }

                    baseObj[key] = assignValue;
                } else {
                    baseObj[key] = value;
                }
            });
        });
    } else {
        Object.assign(baseObj, ...mergeObjs);
    }

    return baseObj;
}

const mutableShallowMerge = mutableMerge.bind(null, false);
const mutableDeepMerge = mutableMerge.bind(null, true);

function mutableOmit(_keys, obj) {
    const keys = forceArray(_keys);
    keys.forEach(key => {
        delete obj[key];
    });
    return obj;
}

function shouldMergeKey(obj, other, key) {
    return obj[key] !== other[key];
}

function immutableMerge(isDeep, ownerID, _mergeObjs, obj) {
    if (canMutate(obj, ownerID)) return mutableMerge(isDeep, _mergeObjs, obj);
    const mergeObjs = forceArray(_mergeObjs);

    let hasChanges = false;
    let nextObject = obj;

    const willChange = () => {
        if (!hasChanges) {
            hasChanges = true;
            nextObject = Object.assign({}, obj);
            prepareNewObject(nextObject, ownerID);
        }
    };

    mergeObjs.forEach(mergeObj => {
        forOwn(mergeObj, (mergeValue, key) => {
            if (isDeep && obj.hasOwnProperty(key)) {
                const currentValue = nextObject[key];
                if (typeof mergeValue === 'object' && !(mergeValue instanceof Array)) {
                    if (shouldMergeKey(nextObject, mergeObj, key)) {
                        const recursiveMergeResult = immutableMerge(
                            isDeep, ownerID, mergeValue, currentValue
                        );

                        if (recursiveMergeResult !== currentValue) {
                            willChange();
                            nextObject[key] = recursiveMergeResult;
                        }
                    }
                    return true; // continue forOwn
                }
            }
            if (shouldMergeKey(nextObject, mergeObj, key)) {
                willChange();
                nextObject[key] = mergeValue;
            }
            return undefined;
        });
    });

    return nextObject;
}

const immutableDeepMerge = immutableMerge.bind(null, true);
const immutableShallowMerge = immutableMerge.bind(null, false);

function immutableArrSet(ownerID, index, value, arr) {
    if (canMutate(arr, ownerID)) return mutableSet(index, value, arr);

    if (arr[index] === value) return arr;

    const newArr = fastArrayCopy(arr);
    newArr[index] = value;
    prepareNewObject(newArr, ownerID);

    return newArr;
}

function immutableSet(ownerID, key, value, obj) {
    if (isArrayLike(obj)) return immutableArrSet(ownerID, key, value, obj);
    if (canMutate(obj, ownerID)) return mutableSet(key, value, obj);

    if (obj[key] === value) return obj;

    const newObj = Object.assign({}, obj);
    prepareNewObject(newObj, ownerID);
    newObj[key] = value;
    return newObj;
}

function immutableOmit(ownerID, _keys, obj) {
    if (canMutate(obj, ownerID)) return mutableOmit(_keys, obj);

    const keys = forceArray(_keys);
    const keysInObj = keys.filter(key => obj.hasOwnProperty(key));

    // None of the keys were in the object, so we can return `obj`.
    if (keysInObj.length === 0) return obj;

    const newObj = Object.assign({}, obj);
    keysInObj.forEach(key => {
        delete newObj[key];
    });
    prepareNewObject(newObj, ownerID);
    return newObj;
}

function mutableArrPush(_vals, arr) {
    const vals = forceArray(_vals);
    arr.push(...vals);
    return arr;
}

function mutableArrFilter(func, arr) {
    let currIndex = 0;
    let originalIndex = 0;
    while (currIndex < arr.length) {
        const item = arr[currIndex];
        if (!func(item, originalIndex)) {
            arr.splice(currIndex, 1);
        } else {
            currIndex++;
        }
        originalIndex++;
    }

    return arr;
}

function mutableArrSplice(index, deleteCount, _vals, arr) {
    const vals = forceArray(_vals);
    arr.splice(index, deleteCount, ...vals);
    return arr;
}

function mutableArrInsert(index, _vals, arr) {
    return mutableArrSplice(index, 0, _vals, arr);
}

function immutableArrSplice(ownerID, index, deleteCount, _vals, arr) {
    if (canMutate(arr, ownerID)) return mutableArrSplice(index, deleteCount, _vals, arr);

    const vals = forceArray(_vals);
    const newArr = arr.slice();
    prepareNewObject(newArr, ownerID);
    newArr.splice(index, deleteCount, ...vals);

    return newArr;
}

function immutableArrInsert(ownerID, index, _vals, arr) {
    if (canMutate(arr, ownerID)) return mutableArrInsert(index, _vals, arr);
    return immutableArrSplice(ownerID, index, 0, _vals, arr);
}

function immutableArrPush(ownerID, vals, arr) {
    return immutableArrInsert(ownerID, arr.length, vals, arr);
}

function immutableArrFilter(ownerID, func, arr) {
    if (canMutate(arr, ownerID)) return mutableArrFilter(func, arr);
    const newArr = arr.filter(func);

    if (newArr.length === arr.length) return arr;

    prepareNewObject(newArr, ownerID);
    return newArr;
}

const immutableOperations = {
    // object operations
    merge: immutableShallowMerge,
    deepMerge: immutableDeepMerge,
    omit: immutableOmit,
    setIn: immutableSetIn,

    // array operations
    insert: immutableArrInsert,
    push: immutableArrPush,
    filter: immutableArrFilter,
    splice: immutableArrSplice,

    // both
    set: immutableSet,
};

const mutableOperations = {
    // object operations
    merge: mutableShallowMerge,
    deepMerge: mutableDeepMerge,
    omit: mutableOmit,
    setIn: mutableSetIn,

    // array operations
    insert: mutableArrInsert,
    push: mutableArrPush,
    filter: mutableArrFilter,
    splice: mutableArrSplice,

    // both
    set: mutableSet,
};


export function getImmutableOps() {
    const immutableOps = Object.assign({}, immutableOperations);
    forOwn(immutableOps, (value, key) => {
        immutableOps[key] = curry(value.bind(null, null));
    });

    const mutableOps = Object.assign({}, mutableOperations);
    forOwn(mutableOps, (value, key) => {
        mutableOps[key] = curry(value);
    });

    const batchOps = Object.assign({}, immutableOperations);
    forOwn(batchOps, (value, key) => {
        batchOps[key] = curry(value);
    });

    function batched(_token, _fn) {
        let token;
        let fn;

        if (typeof _token === 'function') {
            fn = _token;
            token = getBatchToken();
        } else {
            token = _token;
            fn = _fn;
        }

        const immutableOpsBoundToToken = Object.assign({}, immutableOperations);
        forOwn(immutableOpsBoundToToken, (value, key) => {
            immutableOpsBoundToToken[key] = curry(value.bind(null, token));
        });
        return fn(immutableOpsBoundToToken);
    }

    return Object.assign(immutableOps, {
        mutable: mutableOps,
        batch: batchOps,
        batched,
        __: placeholder,
        getBatchToken,
    });
}

export const ops = getImmutableOps();

export default ops;
