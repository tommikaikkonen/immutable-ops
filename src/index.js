import forOwn from 'lodash/forOwn';
import isArrayLike from 'lodash/isArrayLike';
import curry from 'ramda/src/curry';
import wrap from 'ramda/src/wrap';
import placeholder from 'ramda/src/__';

const MUTABILITY_TAG = '@@_______canMutate';

function fastArrayCopy(arr) {
    const copied = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        copied[i] = arr[i];
    }
    return copied;
}

export function canMutate(obj) {
    return obj.hasOwnProperty(MUTABILITY_TAG);
}

function addCanMutateTag(opts, obj) {
    Object.defineProperty(obj, MUTABILITY_TAG, {
        value: true,
        configurable: true,
        enumerable: false,
    });

    opts.batchManager.addMutated(obj);

    return obj;
}

function removeCanMutateTag(obj) {
    delete obj[MUTABILITY_TAG];
    return obj;
}

function prepareNewObject(opts, instance) {
    if (opts.batchManager.isWithMutations()) {
        addCanMutateTag(opts, instance);
    }
    opts.createdObjects++;
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

function mutableSet(opts, key, value, obj) {
    obj[key] = value;
    return obj;
}

function mutableSetIn(opts, _pathArg, value, obj) {
    const originalPathArg = normalizePath(_pathArg);

    const pathLen = originalPathArg.length;
    originalPathArg.reduce((acc, curr, idx) => {
        if (idx === pathLen - 1) {
            acc[curr] = value;
            return value;
        }

        const currType = typeof acc[curr];

        if (currType === 'undefined') {
            const newObj = {};
            prepareNewObject(opts, newObj);
            acc[curr] = newObj;
            return newObj;
        }

        if (currType === 'object') {
            return acc[curr];
        }

        const pathRepr = `${originalPathArg[idx - 1]}.${curr}`;
        throw new Error(`A non-object value was encountered when traversing setIn path at ${pathRepr}.`);
    });

    return obj;
}

function valueInPath(opts, _pathArg, obj) {
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
}

function immutableSetIn(opts, _pathArg, value, obj) {
    const pathArg = normalizePath(_pathArg);

    const currentValue = valueInPath(opts, pathArg, obj);
    if (value === currentValue) return obj;

    const pathLen = pathArg.length;
    let acc = Object.assign(prepareNewObject(opts, {}), obj);
    const rootObj = acc;

    pathArg.forEach((curr, idx) => {
        if (idx === pathLen - 1) {
            acc[curr] = value;
            return;
        }

        const currRef = acc[curr];
        const currType = typeof currRef;

        if (currType === 'object') {
            if (canMutate(currRef)) {
                acc = currRef;
            } else {
                const newObj = prepareNewObject(opts, {});
                acc[curr] = Object.assign(newObj, currRef);
                acc = newObj;
            }
            return;
        }

        if (currType === 'undefined') {
            const newObj = prepareNewObject(opts, {});
            acc[curr] = newObj;
            acc = newObj;
            return;
        }

        const pathRepr = `${pathArg[idx - 1]}.${curr}`;
        throw new Error(`A non-object value was encountered when traversing setIn path at ${pathRepr}.`);
    });

    return rootObj;
}

function mutableMerge(isDeep, opts, _mergeObjs, baseObj) {
    const mergeObjs = forceArray(_mergeObjs);

    if (opts.deep) {
        mergeObjs.forEach(mergeObj => {
            forOwn(mergeObj, (value, key) => {
                if (isDeep && baseObj.hasOwnProperty(key)) {
                    let assignValue;
                    if (typeof value === 'object') {
                        assignValue = canMutate(value)
                            ? mutableMerge(isDeep, opts, [value], baseObj[key])
                            : immutableMerge(isDeep, opts, [value], baseObj[key]); // eslint-disable-line
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

function mutableOmit(opts, _keys, obj) {
    const keys = forceArray(_keys);
    keys.forEach(key => {
        delete obj[key];
    });
    return obj;
}

function _shouldMergeKey(obj, other, key) {
    return obj[key] !== other[key];
}

function immutableMerge(isDeep, opts, _mergeObjs, obj) {
    if (canMutate(obj)) return mutableMerge(isDeep, opts, _mergeObjs, obj);
    const mergeObjs = forceArray(_mergeObjs);

    let hasChanges = false;
    let nextObject = obj;

    const willChange = () => {
        if (!hasChanges) {
            hasChanges = true;
            nextObject = Object.assign({}, obj);
            prepareNewObject(opts, nextObject);
        }
    };

    mergeObjs.forEach(mergeObj => {
        forOwn(mergeObj, (mergeValue, key) => {
            if (isDeep && obj.hasOwnProperty(key)) {
                const currentValue = nextObject[key];
                if (typeof mergeValue === 'object' && !(mergeValue instanceof Array)) {
                    if (_shouldMergeKey(nextObject, mergeObj, key)) {
                        const recursiveMergeResult = immutableMerge(isDeep, opts, mergeValue, currentValue);

                        if (recursiveMergeResult !== currentValue) {
                            willChange();
                            nextObject[key] = recursiveMergeResult;
                        }
                    }
                    return true; // continue forOwn
                }
            }
            if (_shouldMergeKey(nextObject, mergeObj, key)) {
                willChange();
                nextObject[key] = mergeValue;
            }
        });
    });

    return nextObject;
}

const immutableDeepMerge = immutableMerge.bind(null, true);
const immutableShallowMerge = immutableMerge.bind(null, false);

function immutableArrSet(opts, index, value, arr) {
    if (canMutate(arr)) return mutableSet(opts, index, value, arr);

    if (arr[index] === value) return arr;

    const newArr = fastArrayCopy(arr);
    newArr[index] = value;
    prepareNewObject(opts, newArr);

    return newArr;
}

function immutableSet(opts, key, value, obj) {
    if (isArrayLike(obj)) return immutableArrSet(opts, key, value, obj);
    if (canMutate(obj)) return mutableSet(opts, key, value, obj);

    if (obj[key] === value) return obj;

    const newObj = Object.assign({}, obj);
    prepareNewObject(opts, newObj);
    newObj[key] = value;
    return newObj;
}

function immutableOmit(opts, _keys, obj) {
    if (canMutate(obj)) return mutableOmit(opts, _keys, obj);

    const keys = forceArray(_keys);
    const keysInObj = keys.filter(key => obj.hasOwnProperty(key));

    // None of the keys were in the object, so we can return `obj`.
    if (keysInObj.length === 0) return obj;

    const newObj = Object.assign({}, obj);
    keysInObj.forEach(key => {
        delete newObj[key];
    });
    prepareNewObject(opts, newObj);
    return newObj;
}

function mutableArrPush(opts, _vals, arr) {
    const vals = forceArray(_vals);
    arr.push(...vals);
    return arr;
}

function mutableArrFilter(opts, func, arr) {
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

function mutableArrSplice(opts, index, deleteCount, _vals, arr) {
    const vals = forceArray(_vals);
    arr.splice(index, deleteCount, ...vals);
    return arr;
}

function mutableArrInsert(opts, index, _vals, arr) {
    return mutableArrSplice(opts, index, 0, _vals, arr);
}

function immutableArrSplice(opts, index, deleteCount, _vals, arr) {
    if (canMutate(arr)) return mutableArrSplice(opts, index, deleteCount, _vals, arr);

    const vals = forceArray(_vals);
    const newArr = arr.slice();
    prepareNewObject(opts, newArr);
    newArr.splice(index, deleteCount, ...vals);

    return newArr;
}

function immutableArrInsert(opts, index, _vals, arr) {
    if (canMutate(arr)) return mutableArrInsert(opts, index, _vals, arr);
    return immutableArrSplice(opts, index, 0, _vals, arr);
}

function immutableArrPush(opts, vals, arr) {
    return immutableArrInsert(opts, arr.length, vals, arr);
}

function immutableArrFilter(opts, func, arr) {
    if (canMutate(arr)) return mutableArrFilter(opts, func, arr);
    const newArr = arr.filter(func);

    if (newArr.length === arr.length) return arr;

    prepareNewObject(opts, newArr);
    return newArr;
}

const operations = {
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

    mutable: {
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
    },
};

function bindOperationsToOptions(opsObj, opts) {
    const boundOperations = {};

    forOwn(opsObj, (value, key) => {
        if (typeof value === 'object') {
            boundOperations[key] = bindOperationsToOptions(value, opts);
        } else {
            boundOperations[key] = value.bind(null, opts);

            if (opts.curried) {
                boundOperations[key] = curry(boundOperations[key]);
            }
        }
    });

    return boundOperations;
}

function getBatchManager() {
    const previousSessionStack = [];
    let currMutatedObjects = null;
    let objectsCreated = 0;

    return {
        open() {
            if (currMutatedObjects !== null) {
                previousSessionStack.push(currMutatedObjects);
            }
            currMutatedObjects = [];
        },

        isWithMutations() {
            return currMutatedObjects !== null;
        },

        addMutated(obj) {
            currMutatedObjects.push(obj);
            objectsCreated++;
        },

        getMutatedObjects() {
            return currMutatedObjects;
        },

        getObjectsCreatedCount() {
            return objectsCreated;
        },

        close() {
            if (currMutatedObjects !== null) {
                currMutatedObjects.forEach(removeCanMutateTag);
                if (previousSessionStack.length) {
                    currMutatedObjects = previousSessionStack.pop();
                } else {
                    currMutatedObjects = null;
                }
                objectsCreated = 0;
            }
        },
    };
}

export default function getImmutableOps(userOpts) {
    const defaultOpts = {
        curried: true,
        batchManager: getBatchManager(),
    };

    const opts = Object.assign({ createdObjects: 0 }, defaultOpts, (userOpts || {}));

    const boundOperations = bindOperationsToOptions(operations, opts);

    function batchWrapper() {
        const func = arguments[0];
        const args = Array.prototype.slice.call(arguments, 1);
        opts.batchManager.open();
        const returnValue = func.apply(null, args);
        opts.batchManager.close();
        return returnValue;
    }

    boundOperations.batched = batchWrapper;
    boundOperations.batch = wrap(placeholder, batchWrapper);
    boundOperations.createdObjectsCount = () => opts.createdObjects;
    boundOperations.getMutatedObjects = opts.batchManager.getMutatedObjects;
    boundOperations.__ = placeholder;
    boundOperations.open = opts.batchManager.open;
    boundOperations.close = opts.batchManager.close;
    boundOperations.getBatchManager = getBatchManager;

    boundOperations.useBatchManager = manager => {
        opts.batchManager.close();
        opts.batchManager = manager;
        boundOperations.open = manager.open;
        boundOperations.close = manager.close;
        boundOperations.getMutatedObjects = manager.getMutatedObjects;
    };

    return boundOperations;
}
