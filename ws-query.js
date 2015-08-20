"use strict";
var vm = require('vm');
var util = require('util');

// TODO: Clean this up
function object_merge (o1, o2) {
	var out = {};

	if (typeof o1 !== 'object') {
		return object_merge(out, o2);
	}

	for (var p in o1) {
		if (typeof o1[p] !== 'object') {
			out[p] = o1[p];
		} else {
			out[p] = object_merge({}, o1[p]);
		}
	}

	if (typeof o2 !== 'object') {
		return o2;
	}

	for (var q in o2) {
		if (typeof o1[q] !== 'object') {
			out[q] = o2[q];
		} else if (typeof o2[q] === 'object') {
			out[q] = object_merge(o1[q], o2[q]);
		} else {
			out[q] = o2[q];
		}
	}

	return out;
}



var vm_programs = { };
var vm_defaults = { };

function query_load_array_item (query, index) {
	var res = query_load(query, '_ARRAY_');	// XXX: TODO:
	if (res == undefined) {
		return;
	}
	this[index] = res;
}

function query_load_object (query, name) {
	
	// Handle Arrays
	if (Array.isArray(query)) {
		var out = [];
		query.forEach(query_load_array_item, out);
		return out;
	}


	// Process Object Properties
	var out = {};
	for (var p in query) {
		var res = query_load(query[p], p);
		if (res == undefined) {
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
		var vm_global = object_merge(vm_defaults[out._invoke_], out);
		vm_global.console = console;
		vm_global.require = require;
		var vm_ctx = vm.createContext(vm_global);
		var res = vm_programs[out._invoke_].runInContext(vm_ctx, { displayErrors: true, timeout: 60 * 1000 });
		return res;
	}

	// Return Object
	return out;
}

function query_load (query, name) {	

	// Handle edge-cases
	if (query == undefined || query == null) {
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
