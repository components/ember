all: node_modules ember.min.js

node_modules:
	@npm install

ember.min.js: ember.js
	@uglifyjs --no-mangle $< > $@ && du -bh $< $@

ember.js: data
	@cd $< && git pull
	@cp -f $</packages/ember/lib/main.js $@

data:
	@git clone https://github.com/emberjs/data.git $@

.PHONY: ember.js ember.min.js