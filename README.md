Diogenes
========

Diogenes is a services registry.

What is a service
-----------------
A service is a function that takes a configuration and a list of dependencies (other services).
The configuration is common to all services.

From functions to services
--------------------------
Let's say that you have a function returning an html page. You usually need to execute a certain number of steps (already incapsulated into functions):

    decodeURL(url, function (id){
      getDB(config, function (db){
        getDataFromDB(id, function (obj){
          retrieveTemplate("template.html", function (template){
            renderTemplate(template, obj, function (html){
              returnHTML(html)
            });
          });
        });
      });
    });

I am sure you have already seen something like this.
Well, I can see more than one issue here. The first one, the pyramid of doom, can be solved easily using promises (or other techniques).
But there is a worst issue, you are designing the workflow, how the components interact between them in an imperative way.
This is awkward as you'll either use the same patterns again and again, or you'll spend a lot of time refactoring the old code trying to  avoid repetition.

With Diogenes you can describe the flow of informations in terms of services, describing the relations between them:

    var Diogenes = require('diogenes');
    var registry = Diogenes.getRegistry();

    registry.add("id", decodeURL);
    registry.add("db",  getDB);
    registry.add("data", ["db", "url"], getDataFromDB); // the array defines the dependencies
    registry.add("template", retrieveTemplate);
    registry.add("html", ["template", "data"], renderTemplate);

and let the system do the job:

    registry.run("html", configuration, returnHTML);

Diogenes resolves all the dependency tree for you, executing the services in the right order (even in parallel when possible).
Then it serves you the result on a silver platter.

A step by step example
======================

Importing diogenes
------------------
The easiest way to import Diogenes is using commonjs:

    var Diogenes = require('diogenes');

You can also import it as a global module. In that case you should take care of the dependencies (setImmediate and occamsrazor).

Creating a registry
-------------------
You can create a registry with:

    var registry = Diogenes.getRegistry();

Without arguments you create a "local registry" that is reachable within the scope of the "registry" variable.
If you pass a name to the constructor you create a global registry that is available everywhere:

    var registry = Diogenes.getRegistry("myregistry");

Defining services
-----------------
A service is defined by a name (a string), a list of dependencies (an optional list of strings) and a function with a specific interface:

    registry.add("text", function (config, deps, next) {
        var text = ["Diogenes became notorious for his philosophical ",
          "stunts such as carrying a lamp in the daytime, claiming to ",
          "be looking for an honest man."].join();
        next(undefined, text);
    });

if the service is successful I pass undefined as the first argument and the result as second:

    registry.add("tokens", ['text'], function (config, deps, next) {
        next(undefined, deps.text.split(' '));
    });

The array specifies a list of dependencies. This service depends on the "text" service. The deps argument will contain an attribute for every dependency
in this example: deps.text.

    registry.add("count", ['tokens'], function (config, deps, next) {
        next(undefined, deps.tokens.length);
    });

    registry.add("abstract", ['tokens'], function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.tokens.slice(0, len).join(' ') + ellipsis);
    });

The "config" argument is passed to all services.

    registry.add("paragraph", ['text', 'abstract', 'count'], function (config, deps, next) {
        next(undefined, {
            count: deps.count,
            abstract: deps.abstract,
            text: deps.text
        });
    });

Calling a service
-----------------
You can call a service using the method getService with the name and the configuration (the same one will be passed as argument to all services).

    registry.run("paragraph", {abstractLen: 5, abstractEllipsis: "..."}, function (err, p){
        if (err){
            console.log("Something went wrong!");
        }
        else {
            console.log("This paragraph is " + p.count + " words long");
            console.log("The abstract is: " + p.anstract);
            console.log("This is the original text:");
            console.log(p.text);            
        }
    });

p will be the output of the paragraph service. If any services throws, or returns an error. This function will be executed anyway and the "err" argument will contain the exception.
Diogenes calls all the services in order. You can get the ordering using:

    registry.getExecutionOrder("paragraph", {abstractLen: 5, abstractEllipsis: "..."});

It will return an array: ["text", "tokens", "abstract", "count", "paragraph"]
Diogenes does not follow that order exactly: "count", for example doesn't require to wait for abstract as it depends on tokens only.

Plugins
-------
A registry can have more than one service with the same name (and a different set of dependencies).
The correct service will be chosen using the configuration and an [occamsrazor validator](https://github.com/sithmel/occamsrazor.js#tutorial).
Diogenes.validator is a copy of occamsrazor.validator (for convenience). Let's say for example that you want to use a different way to get the abstract:

    var useAlternativeClamp = Diogenes.validator().match({abstractClamp: "chars"});

    registry.add("abstract", ['text'], useAlternativeClamp, function (config, deps, next) {
        var len = config.abstractLen;
        var ellipsis = config.abstractEllipsis;
        next(undefined, deps.text.slice(0, len) + ellipsis);
    });

You should notice that specifying a validator you are also able to use a different set of dependencies.

    registry.getExecutionOrder("paragraph", {abstractLen: 5, abstractEllipsis: "...", abstractClamp: "chars"});

    registry.run("paragraph", {abstractLen: 5, abstractEllipsis: "...", abstractClamp: "chars"}, function (err, p){
        if (err){
            console.log("Something went wrong!");
        }
        else {
            console.log("This paragraph is " + p.count + " words long");
            console.log("The abstract is: " + p.anstract);
            console.log("This is the original text:");
            console.log(p.text);
        }
    });

The key point is that you just extended the system without changing the original code!

Add a value
-----------

Run service only once
---------------------

Working with a single service
-----------------------------

Cache a service
---------------

Dependencies
============
Diogenes depends on setimmediate and occamsrazor.

Syntax
======

Diogenes.getRegistry
--------------------
Create a registry of services:

    var registry = Diogenes.getRegistry();

or

    var registry = new Diogenes();

If you don't pass any argument this registry will be local. And you will need to reach the local variable "registry" to use its services.
If you pass a string, the registry will use a global variable to store services:

    var registry = Diogenes.getRegistry("myregistry");

or

    var registry = new Diogenes("myregistry");

This is convenient if you want any application register its services to a specific registry.

Registry's methods
==================

service
-------
Returns a single service. It creates the service if it doesn't exist.

Syntax:

    registry.service("name");

add
---
it adds a service to a registry. It has different signatures:

    registry.addService(name, func);   

    registry.addService(name, dependencies, func);   

    registry.addService(name, dependencies, validator, func);   

* The name (mandatory) is a string. It is the name of the service. A registry can have more than one service with the same name BUT they should validate alternatively (see the validator argument).
* dependencies: it is an array of strings. Every string is the name of a service. This should be executed and its output should be pushed in the function
* validator: it is an occamsrazor validator. (https://github.com/sithmel/occamsrazor.js). You can also pass a different value as explained in the "match" validator (https://github.com/sithmel/occamsrazor.js#occamsrazorvalidatormatch);
* The function (mandatory) is a function that returns a service.

The function will have these arguments (config, deps, next):
* config is a value passed to all services when getService is invoked
* deps is an object. It has as many properties as the dependencies of this service. The attributes of deps have the same name of the respective dependency.
* next is the function called with the output of this service: next(undefined, output)
* If something goes wrong you can pass the error as first argument: next(new Error('Something wrong!')). 

It returns the registry.

addValue
--------

addOnce
-------

addValueOnce
------------

remove
------
It remove a service from the registry:

    registry.removeService(name);

It returns the registry.

run
---
It executes all the dependency tree required by the service and call the function. All the services are called using config:

    registry.getService(name, config, func);

The function takes 2 arguments:
* an error
* the value of the service required

It returns the registry.

getExecutionOrder
-----------------
Returns an array of services that should be executed with those arguments. The services are sorted by dependencies. It is not strictly the execution order as diogenes is able to execute services in parallel if possible.

    registry.getExecutionOrder(name, config);

Chaining
--------
add, remove and run are chainable. So you can do for example:

    registry.add("service1", service1)
    .add("service1", service2);
    .add("myservice", ["service1", "service2"], myservice);

Service's methods
==================
You can get a service with the "service" method.

add
---

addValue
--------

addOnce
-------

addValueOnce
------------

remove
------

run
---

cacheOn
-------

cacheOff
--------

cacheReset
----------

Exceptions
==========
The library is currently able to detect and throws exceptions in a few cases:

* circular dependencies
* missing dependencies (or incompatible plugin)
* more than one plug-in matches (using a validator)
* the service returns or throws an exception

The first 3 exceptions can be thrown by getExecutionOrder and getService.
The last one only using getService.

Tricks and tips
===============

Avoid mutations
---------------
Do not mutate the config and deps arguments! It will lead to unpredictable bugs. Clone the object instead.

