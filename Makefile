BIN=node_modules/.bin

MOCHA_ARGS= --require @babel/register
MOCHA_TARGET=src/**/test*.js

clean:
	rm -rf lib es

build: clean
	BABEL_ENV=cjs $(BIN)/babel src --out-dir lib
	BABEL_ENV=es $(BIN)/babel src --out-dir es

test: lint
	NODE_ENV=test $(BIN)/mocha $(MOCHA_ARGS) $(MOCHA_TARGET)

test-watch: lint
	NODE_ENV=test $(BIN)/mocha $(MOCHA_ARGS) -w $(MOCHA_TARGET)

lint:
	$(BIN)/eslint src

PHONY: build clean test test-watch lint
