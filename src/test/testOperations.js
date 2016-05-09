import chai from 'chai';
import sinonChai from 'sinon-chai';
import getOps, { canMutate } from '../index';
import freeze from 'deep-freeze';
import compose from 'ramda/src/compose';

chai.use(sinonChai);
const { expect } = chai;

describe('operations', () => {
    let ops;

    beforeEach(() => {
        ops = getOps();
    });

    it('wrapBatched', () => {
        const pushFour = ops.push(4);
        const pushFive = ops.push(5);
        const arr = freeze([1, 2, 3]);

        const pusher = ops.batch(compose(pushFive, pushFour));
        expect(pusher).to.be.a('function');

        const result = pusher(arr);
        expect(result).to.deep.equal([1, 2, 3, 4, 5]);
    });

    it('useBatchManager', () => {
        const myManager = ops.getBatchManager();
        ops.useBatchManager(myManager);

        const pusher = ops.push(0);
        const batchOperation = ops.batch((arr) => {
            const first = pusher(arr);
            expect(ops.getMutatedObjects()).to.equal(myManager.getMutatedObjects());
            expect(ops.getMutatedObjects()[0]).to.equal(first);
            return first;
        });

        batchOperation([]);
    });

    describe('object', () => {
        describe('batched mutations', () => {
            it('deepMerges', () => {
                const baseObj = freeze({
                    change: 'Tommi',
                    dontChange: 25,
                    deeper: {
                        dontChange: 'John',
                        change: 30,
                    },
                });
                const mergeObj = freeze({
                    change: 'None',
                    add: 'US',
                    deeper: {
                        add: 'US',
                        change: 35,
                    },
                });
                let result;
                const merger = ops.deepMerge(mergeObj);
                ops.batched(() => {
                    result = merger(baseObj);
                    expect(canMutate(result)).to.be.true;
                    expect(canMutate(result.deeper)).to.be.true;
                });

                expect(canMutate(result)).to.be.false;
                expect(canMutate(result.deeper)).to.be.false;

                expect(result).to.not.equal(baseObj);

                expect(result).to.contain.all.keys(['change', 'dontChange', 'add', 'deeper']);
                expect(result.change).to.not.equal(baseObj.change);
                expect(result.dontChange).to.equal(baseObj.dontChange);

                expect(result.deeper).to.not.equal(baseObj.deeper);
                expect(result.deeper).to.contain.all.keys(['dontChange', 'change', 'add']);
                expect(result.deeper.dontChange).to.equal(baseObj.deeper.dontChange);
                expect(result.deeper.change).to.not.equal(baseObj.deeper.change);
            });

            it('omits a single key', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                let result;
                const omitter = ops.omit('age');

                ops.batched(() => {
                    result = omitter(obj);
                    expect(canMutate(result)).to.be.true;
                });

                expect(canMutate(result)).to.be.false;
                expect(result).to.not.contain.keys(['age']);
            });

            it('omits an array of keys', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                let result;

                const omitter = ops.omit(['age']);
                ops.batched(() => {
                    result = omitter(obj);

                    expect(canMutate(result)).to.be.true;
                });

                expect(canMutate(result)).to.be.false;
                expect(result).to.not.contain.keys(['age']);
            });

            it('sets a value', () => {
                const obj = freeze({
                    one: 1,
                    two: 500,
                    three: 3,
                });

                let result;
                ops.batched(() => {
                    result = ops.set('two', 5, obj);

                    expect(canMutate(result)).to.be.true;
                    result = ops.set('two', 2, result);
                });
                expect(result).to.deep.equal({
                    one: 1,
                    two: 2,
                    three: 3,
                });
            });

            it('sets a value in path', () => {
                const obj = freeze({
                    first: {
                        second: {
                            value: 'value',
                            maintain: true,
                        },
                        maintain: true,
                    },
                    maintain: true,
                });
                let result;

                const setter = ops.setIn('first.second.value', 'anotherValue');

                ops.batched(() => {
                    result = setter(obj);

                    expect(canMutate(result)).to.be.true;
                });

                expect(canMutate(result)).to.be.false;
                expect(result).not.to.equal(obj);
                expect(result.first.second.value).to.equal('anotherValue');
                expect(result.maintain).to.be.true;
                expect(result.first.maintain).to.be.true;
                expect(result.first.second.maintain).to.be.true;
            });
        });

        describe('immutable ops', () => {
            it('deepMerges', () => {
                const baseObj = freeze({
                    change: 'Tommi',
                    dontChange: 25,
                    deeper: {
                        dontChange: 'John',
                        change: 30,
                    },
                });
                const mergeObj = freeze({
                    change: 'None',
                    add: 'US',
                    deeper: {
                        add: 'US',
                        change: 35,
                    },
                });

                const merger = ops.deepMerge(mergeObj);
                const result = merger(baseObj);

                expect(canMutate(result)).to.be.false;
                expect(canMutate(result.deeper)).to.be.false;

                expect(result).to.not.equal(baseObj);

                expect(result).to.contain.all.keys(['change', 'dontChange', 'add', 'deeper']);
                expect(result.change).to.not.equal(baseObj.change);
                expect(result.dontChange).to.equal(baseObj.dontChange);

                expect(result.deeper).to.not.equal(baseObj.deeper);
                expect(result.deeper).to.contain.all.keys(['dontChange', 'change', 'add']);
                expect(result.deeper.dontChange).to.equal(baseObj.deeper.dontChange);
                expect(result.deeper.change).to.not.equal(baseObj.deeper.change);
            });

            it('deepMerges and returns initial object when no values changed', () => {
                const baseObj = freeze({
                    deep: {
                        dontChange: 'John',
                    },
                });
                const mergeObj = freeze({
                    deep: {
                        dontChange: 'John',
                    },
                });

                const result = ops.deepMerge(mergeObj, baseObj);
                expect(result).to.equal(baseObj);
            });

            it('omits a single key', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                const omitter = ops.omit('age');
                const result = omitter(obj);

                expect(canMutate(result)).to.be.false;
                expect(result).to.not.contain.keys(['age']);
            });

            it('omits a single key, returns same object if no value changes', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                const result = ops.omit('location', obj);
                expect(result).to.equal(obj);
            });

            it('omits an array of keys', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                const omitter = ops.omit(['age']);
                const result = omitter(obj);

                expect(canMutate(result)).to.be.false;
                expect(result).to.not.contain.keys(['age']);
            });

            it('sets a value', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                const result = ops.set('age', 26, obj);
                expect(result).to.deep.equal({
                    name: 'Tommi',
                    age: 26,
                });
            });

            it('sets a value and returns the initial value of no changes', () => {
                const obj = freeze({
                    name: 'Tommi',
                    age: 25,
                });

                const result = ops.set('age', 25, obj);
                expect(result).to.equal(obj);
            });

            it('sets a value in path', () => {
                const obj = freeze({
                    first: {
                        second: {
                            value: 'value',
                            maintain: true,
                        },
                        maintain: true,
                    },
                    maintain: true,
                });

                const setter = ops.setIn('first.second.value', 'anotherValue');

                const result = setter(obj);

                expect(canMutate(result)).to.be.false;
                expect(result).not.to.equal(obj);
                expect(result.first.second.value).to.equal('anotherValue');
                expect(result.maintain).to.be.true;
                expect(result.first.maintain).to.be.true;
                expect(result.first.second.maintain).to.be.true;
            });

            it('sets a value in path but returns same object if no value changes', () => {
                const obj = freeze({
                    first: {
                        second: {
                            value: 'value',
                            maintain: true,
                        },
                        maintain: true,
                    },
                    maintain: true,
                });

                const result = ops.setIn('first.second.value', 'value', obj);
                expect(result).to.equal(obj);
            });
        });
    });

    describe('array', () =>{
        describe('batched mutations', () => {
            it('push', () => {
                const push = ops.push;
                const arr = freeze([5, 4]);
                const pusher = push(freeze([1, 2, 3]));
                const result = ops.batched(() => pusher(arr));

                expect(result).to.not.equal(arr);

                expect(result).to.deep.equal([5, 4, 1, 2, 3]);
            });

            it('insert', () => {
                const insert = ops.insert;
                const arr = freeze([1, 2, 5]);
                const inserter = insert(2, freeze([3, 4]));
                const result = ops.batched(() => inserter(arr));

                expect(result).to.deep.equal([1, 2, 3, 4, 5]);
            });

            it('filter', () => {
                const arr = freeze([0, 1, 2, 3]);
                let result;

                ops.batched(() => {
                    result = ops.filter(item => item % 2 === 0, arr);
                    expect(canMutate(result)).to.be.true;
                });

                expect(result).to.deep.equal([0, 2]);
                expect(canMutate(result)).to.be.false;
            });

            it('set', () => {
                const arr = freeze([1, 2, 987, 4]);

                const result = ops.batched(() => {
                    const setter = ops.set(2, 3);
                    const res = setter(arr);
                    expect(canMutate(res)).to.be.true;
                    return res;
                });

                expect(canMutate(result)).to.be.false;
                expect(result).to.deep.equal([1, 2, 3, 4]);
            });

            it('splice with deletions', () => {
                const splice = ops.splice;
                const arr = freeze([1, 2, 3, 3, 3, 4]);
                const splicer = splice(2, 2, []);

                const result = ops.batched(() => splicer(arr));

                expect(result).to.deep.equal([1, 2, 3, 4]);
            });

            it('splice with additions', () => {
                const splice = ops.splice;
                const arr = freeze([1, 5]);
                const splicer = splice(1, 0, [2, 3, 4]);

                const result = ops.batched(() => splicer(arr));

                expect(result).to.deep.equal([1, 2, 3, 4, 5]);
            });
        });

        describe('immutable ops', () => {
            it('push', () => {
                const push = ops.push;
                const arr = freeze([5, 4]);
                const pusher = push(freeze([1, 2, 3]));
                const result = pusher(arr);

                expect(result).to.not.equal(arr);

                expect(result).to.deep.equal([5, 4, 1, 2, 3]);
            });

            it('insert', () => {
                const insert = ops.insert;
                const arr = freeze([1, 2, 5]);
                const inserter = insert(2, freeze([3, 4]));
                const result = inserter(arr);

                expect(result).to.deep.equal([1, 2, 3, 4, 5]);
            });

            it('filter', () => {
                const arr = freeze([0, 1, 2, 3]);

                const result = ops.filter(item => item % 2 === 0, arr);

                expect(result).to.deep.equal([0, 2]);
                expect(canMutate(result)).to.be.false;
            });

            it('filter with no effect should return initial array', () => {
                const arr = freeze([0, 1, 2, 3]);
                const result = ops.filter(item => item < 4, arr);
                expect(result).to.equal(arr);
            });

            it('set', () => {
                const arr = freeze([1, 2, 987, 4]);

                const result = ops.set(2, 3, arr);

                expect(canMutate(result)).to.be.false;
                expect(result).to.deep.equal([1, 2, 3, 4]);
            });

            it('set with no effect should return initial array', () => {
                const arr = freeze([1, 2, 3, 4]);

                const result = ops.set(2, 3, arr);
                expect(result).to.equal(arr);
            });

            it('splice with deletions', () => {
                const splice = ops.splice;
                const arr = freeze([1, 2, 3, 3, 3, 4]);
                const splicer = splice(2, 2, []);

                const result = splicer(arr);
                expect(result).to.deep.equal([1, 2, 3, 4]);
            });

            it('splice with additions', () => {
                const splice = ops.splice;
                const arr = freeze([1, 5]);
                const splicer = splice(1, 0, [2, 3, 4]);

                const result = splicer(arr);

                expect(result).to.deep.equal([1, 2, 3, 4, 5]);
            });
        });
    });
});
