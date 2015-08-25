//"use strict";
var vm = require('vm');
var util = require('util');

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

	// Merge all the arguments...
	for (var i = 1; i < length; i++) {
		var extension = arguments[i];

		// Ignore extension if it's undefined or the same as the target
		if (extension === undefined || extension === target) {
			// XXX: Should we warn if extension is target?
			continue;
		}

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
			if (src && typeof src === 'object') {
				// Cloning src
				var clone = {};

				// We actually need an Array object...
				if (Array.isArray(dst) || Array.isArray(src)) {
					clone = [];
				}

				// Do the actual clone and merge...
				target[prop] = object_merge(clone, dst, src);

			// Standard property, no merge needed.
			} else if (src !== undefined) {
				target[prop] = src;
			}
		}
	}

	// The last extension was not an object, so return that value
	if (last !== undefined)
		return last;

	// Return the target object
	return target;
}

var vm_programs = { };
var vm_defaults = { };

function query_load_array_item (query, index) {
	var res = query_load(query, '_ARRAY_');	// XXX: TODO:
	if (res === undefined) {
		return;
	}
	this[index] = res;
}

function query_load_object (query, name) {
	var out = {};
	
	// Handle Arrays
	if (Array.isArray(query)) {
		out = [];
		query.forEach(query_load_array_item, out);
		return out;
	}


	// Process Object Properties
	for (var p in query) {
		var res = query_load(query[p], p);
		if (res === undefined) {
			continue;
		}
		out[p] = res;
	}

	// Process a "Code" Object
	if (query._define_) {
		vm_programs[name] = new vm.Script(query._define_, { filename: name, displayErrors: false });
		vm_defaults[name] = query;
		return undefined;
	}

	// Process an "Executable" Object
	if (out._invoke_) {
		var vm_global = object_merge({}, vm_defaults[out._invoke_], out);
		vm_global.console = console;
		vm_global.require = require;
		var vm_ctx = vm.createContext(vm_global);
		return vm_programs[out._invoke_].runInContext(vm_ctx, { displayErrors: true, timeout: 60 * 1000 });
	}

	// Return Object
	return out;
}

function query_load (query, name) {	

	// Handle edge-cases
	if (query === undefined || query === null) {
		return query;
	}

	// Process Objects
	if (typeof query === 'object') {
		return query_load_object(query, name);
	}

	// Return Primatives
	return query;
}

if (process.argv < 3) {
	console.log('Invalid Arguments!');
	console.log('Syntax: node ws-query.js [config_file]');
	return;
}

var config = process.argv[2];
if (config[0] != '/') {
	config = "./" + config;
}

var res = query_load(require(config), config);

console.log(util.inspect(res, { depth: null, colors: true}));

//console.log(util.inspect(process._getActiveRequests(), { depth: 5}));
//console.log(util.inspect(process._getActiveHandles(), { depth: 5 }));
