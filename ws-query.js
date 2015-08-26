//"use strict";
var vm = require('vm');
var util = require('util');

var hooks = null;
function object_merge () {
	var length = arguments.length;
	var target = arguments[0];
	var last; // If this is defined, we return it instead of target

	// Can't merge less than 2 objects
	if (length < 2) {
		if (length == 1) {
			return target;
		}
		return undefined;
	}

	// Determine if the target is object is suitable for merging
	if (typeof target !== 'object') {
		last = target;
		target = {};
	}

	// XXX: BUG: How to properly handle Arrays and "Functions"?

	// Handle "aspect" hooks for processing...
	//var hooks = target.prototype.merge_hooks;
	if (!hooks) {
		hooks = {
			before: function(prop, dst, src) { return src; },
			after: function(prop, dst, src) { return dst; }
		};
	}

	// Merge all the arguments...
	for (var i = 1; i < length; i++) {
		var extension = arguments[i];

		// Ignore extension if it's undefined or the same as the target
		if (extension === undefined || extension === target) {
			// XXX: Should we warn if extension is target?
			continue;
		}

		// Call hook before processing object
		//extension = hooks.before(extension); // XXX: Seperate hook?

		// Handle extensions that are not objects
		if (typeof extension !== 'object') {
			target = {};
			last = extension;
			continue;
		}
		last = undefined;

		// Cycle through all the properties
		for (var prop in extension) {
			var src = extension[prop];
			var dst = target[prop];

			// Continue if the src and dst are the same
			if (src === dst) {
				continue;
			}

			// Prevent an infinite loop
			if (src === target) {
				target[prop] = target;
				continue;
			}

			// Do the actual merge
			// XXX: Flag to disable cloning?
			if (src && typeof src === 'object') {

				// Call hook before processing object
				src = hooks.before(prop, dst, src);

				// Cloning src
				var clone = {};

				// We actually need an Array object...
				if (Array.isArray(dst) || Array.isArray(src)) {
					clone = [];
				}

				// Do the actual clone and merge...
				clone = object_merge(clone, dst, src);

				// Call hook after processing object
				clone = hooks.after(prop, clone, src);

				if (clone === undefined) {
					continue;
				}
				target[prop] = clone;

			// Standard property, no merge needed.
			} else if (src !== undefined) {
				target[prop] = src;
			}
		}

		// Call hook after processing object
		//last = hooks.after(extension); // XXX: Seperate hook?
	}

	// The last extension was not an object, so return that value
	if (last !== undefined)
		return last;

	// Return the target object
	return target;
}

var vm_programs = { };
var vm_defaults = { };
var hooks = {
	before: function(prop, dst, src) { return src; },
	after: query_hook
};

function query_hook (prop, dst, src) {

	// Not an object, just return it as is
	if (typeof dst !== 'object') {
		return dst;
	}

	// Define a macro object
	if (dst._define_) { // XXX: Not a string?
		var define = dst._define_;
		vm_defaults[define] = dst;
		// XXX: dst._code_ might not be a string!
		if (dst._code_) {
			var code = dst._code_;
			vm_programs[define] = new vm.Script(code, {
					filename: define,
					displayErrors: false
			});
		}
		return undefined;
	}

	// Execute a macro object
	if (dst._invoke_) { // XXX: Not a string?
		var invoke = dst._invoke_;
		var ctx = object_merge({}, vm_defaults[invoke], dst);

		// We are a simple macro object with no code...
		if (!vm_programs[invoke]) {
			return ctx;
		}

		// We have code to run... Do it in a "sandbox".
		ctx.console = console;
		ctx.require = require;
		var vm_ctx = vm.createContext(ctx);
		return vm_programs[invoke].runInContext(vm_ctx, {
				displayErrors: true,
				timeout: 60 * 1000
		});
	}

	// Ignore a comment object
	if (dst._comment_) {
		return undefined;
	}

	// Return input
	return dst;
}

if (process.argv.length < 3) {
	console.log('Invalid Arguments!');
	console.log('Syntax: node ws-query.js [config_file]');
	return;
}

var config = process.argv[2];
if (config[0] != '/') {
	config = "./" + config;
}

var query = object_merge({}, require(config));

console.log(util.inspect(query, { depth: null, colors: true}));

//console.log(util.inspect(process._getActiveRequests(), { depth: 5}));
//console.log(util.inspect(process._getActiveHandles(), { depth: 5 }));
