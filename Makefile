engines = 0.12 4. 6. 7.

all: engines

engines: $(engines)

$(engines):
	n $@
	npm test

.PHONY: all \
	engines $(engines)
