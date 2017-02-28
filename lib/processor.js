'use strict';

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs-extra'));
var path = require('path');

var transform = Promise.method(function(layouts, source, opt, Handlebars) {
	var template = Handlebars.compile(source);

	return template({
		layouts: layouts,
		opt: opt,
		indicator: '.'
	});
});

module.exports = {
	process: function(layouts, opt, Handlebars) {
		return fs.readFileAsync(path.join(__dirname, 'template.hbs'), 'utf8')
			.then(function(source) {
				return transform(layouts, source, opt, Handlebars);
			});
	},
	isBeautifyable: function(opt) {
		return true;
	},
	extension: function(opt) {
		return 'scss';
	}
};
