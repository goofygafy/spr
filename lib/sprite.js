'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var through2 = require('through2');
var crypto = require('crypto');
var url = require('url');
var Color = require('color');
var path = require('path');

var engine = require("./engine");
var log;

var sortByDim = function(a, b) {
	return a.ratio - b.ratio;
};

var getUrl = function(opt, name, ext) {
	var cachebuster = !opt.cachebuster ? '' : '?' + crypto.randomBytes(20).toString('hex');
	if (opt.cssPath.indexOf('//') > -1) {
		return url.resolve(opt.cssPath, name + '.' + ext) + cachebuster;
	}
	else {
		return path.join(opt.cssPath, name + '.' + ext).replace(/\\/g, '/') + cachebuster;
	}
};

var getName = function(dim, name) {
	return dim.ratio === 1 ? name : name + '@' + dim.ratio + 'x';
};

var renderSprite = function(layout, ratio, opt) {
	var opacity = opt.opacity;
	var backgroundColor = new Color(opt.background);
	backgroundColor = backgroundColor.rgb().array();
	backgroundColor.push(opacity);
	var tiles = [];
	_.each(layout.layout.items, function(tile) {
		tiles.push({
			height: tile.meta.height,
			width: tile.meta.width,
			x: tile.x,
			y: tile.y,
			type: tile.meta.type,
			offset: opt.margin,
			contents: tile.meta.contents,
			path: tile.meta.path
		});
	});
	
	return engine.create(tiles, {
		width: layout.layout.width,
		height: layout.layout.height,
		bgColor: backgroundColor,
		log: log,
		options: opt
	});
};

var scaleSprite = function(base, ratio, opt) {
	var scale = ratio / base.ratio;
	var width = Math.floor(base.width * scale);
	var height = Math.floor(base.height * scale);
	
	return engine.scale(base, {
		scale: scale,
		width: width,
		height: height,
		log: log,
		options: opt
	});
};

var createSprite = function(dim, layout, opt, base) {
	var image;
	var name = getName(dim, layout.name === 'default' ? opt.name : opt.name + '-' + layout.name);
	if (!base) {
		image = renderSprite(layout, dim.ratio, opt);
	}
	else {
		image = scaleSprite(base, dim.ratio, opt);
	}
	
	return image.then(function(img) {
		var spriteUrl = getUrl(opt, name, img.type);
		if (opt.base64) {
			spriteUrl = 'data:' + img.mimeType + ';base64,' + img.contents.toString('base64');
		}
		return Promise.resolve({
			name: name,
			url: spriteUrl,
			type: img.type,
			contents: img.contents,
			dpi: dim.default ? null : dim.dpi,
			ratio: dim.default ? null : dim.ratio,
			width: img.width,
			height: img.height
		});
	});
};

var createOtherSprites = function(dim, layout, opt, baseSprite) {
	return Promise.map(dim, function(d) {
		return createSprite(d, layout, opt, baseSprite);
	});
};

var createSprites = function(opt) {
	return function(layout, enc, cb) {
		if (layout) {
			layout.sprites = [];

			opt.dimension.sort(sortByDim).reverse();
			opt.dimension[opt.dimension.length - 1].default = true;

			createSprite(opt.dimension[0], layout, opt)
				.then(function(baseSprite) {
					layout.sprites.push(baseSprite);
					return opt.dimension.length > 1 ? createOtherSprites(opt.dimension.slice(1), layout, opt, baseSprite) : true;
				})
				.then(function(otherSprites) {
					if (_.isArray(otherSprites)) {
						Array.prototype.push.apply(layout.sprites, otherSprites);
					}
					layout.sprites.reverse();
					cb(null, layout);
				});
		}
		else {
			cb();
		}
	};
};

module.exports = function(opt) {
	log = opt.logger;

	return through2.obj(createSprites(opt));
};
