CC      ?= gcc
CFLAGS  ?= -O2 -std=c11 -Wall -Wextra -Wpedantic -D_POSIX_C_SOURCE=199309L
BUILD   := build
INC     := -Iinclude

ifeq ($(shell uname -s),Darwin)
  LIBEXT := dylib
else
  LIBEXT := so
endif

LIB := $(BUILD)/libtitlesearch.$(LIBEXT)
CLI := $(BUILD)/titlesearch_cli
TST := $(BUILD)/test_engine

.PHONY: all test clean

all: $(LIB) $(CLI)

$(BUILD):
	mkdir -p $(BUILD)

$(LIB): src/titlesearch.c include/titlesearch.h | $(BUILD)
	$(CC) $(CFLAGS) $(INC) -fPIC -shared -o $@ src/titlesearch.c

$(CLI): cli/main.c src/titlesearch.c include/titlesearch.h | $(BUILD)
	$(CC) $(CFLAGS) $(INC) -o $@ cli/main.c src/titlesearch.c

$(TST): tests/test_engine.c src/titlesearch.c include/titlesearch.h | $(BUILD)
	$(CC) $(CFLAGS) $(INC) -fsanitize=address,undefined -g -o $@ tests/test_engine.c src/titlesearch.c

test: $(TST) $(CLI)
	./$(TST)
	./$(CLI) < tests/sample_input.txt | diff - tests/sample_output.txt && echo "CLI sample: OK"

clean:
	rm -rf $(BUILD)
