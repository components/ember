VERSION=v1.1.0-beta.2

default: emberjs
	@cd $< && git checkout master -f && git pull && git checkout $(VERSION) && bundle install && rake dist
	@cp -f $</dist/ember.js .
	@cp -f $</dist/ember.min.js .
	@cp -f $</dist/ember.prod.js .

emberjs:
	@git clone https://github.com/emberjs/ember.js.git $@

.PHONY: default
