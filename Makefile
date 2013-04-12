all: ember.js ember.min.js
	@du -bh $^

ember.js: dist/dist
	@cp $</$@ $@

ember.min.js: dist/dist
	@cp $</$@ $@

dist/dist: dist
	@cd $< && git pull && bundle && bundle exec rake dist

dist:
	@git clone https://github.com/emberjs/ember.js.git $@

.PHONY: default