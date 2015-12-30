Diogenes
========
![Registry as graph](https://upload.wikimedia.org/wikipedia/commons/b/b6/Diogenes_looking_for_a_man_-_attributed_to_JHW_Tischbein.jpg)
> When asked why he went about with a lamp in broad daylight, Diogenes confessed, "I am looking for a [honest] man."

Diogenes defines and executes functions with a common interface (services) configured in a directed acyclic graph.

What is a service
-----------------
I define a "service" as a function with a specific interface. Its arguments are:

* a configuration, common to all services
* a list of dependencies (the output of other services)
* a callback (services are asynchronous by default)

A service outputs a "dependency", this is identified with a name.
Services are organized inside registries. The common interface allows to automatise how the dependencies are resolved within the registry.

From functions to services
--------------------------
Let's say that you have a function returning an html page. You usually need to execute a certain number of steps (already incapsulated into functions):
```js
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
```
I am sure you have already seen something like this.
Well, I can see more than one issue here. The first one, the pyramid of doom, can be solved easily using promises (or other techniques).
But there is a worst issue, you are designing how the components interact between them, in an imperative way.
This is awkward as you'll either use the same patterns again and again, or you'll spend a lot of time refactoring the old code trying to avoid repetition.

With Diogenes you can describe the flow of informations in terms of services, describing the relations between them:
```js
var Diogenes = require('diogenes');
var registry = Diogenes.getRegistry();

registry.add("id", decodeURL);
registry.add("db",  getDB);
registry.add("data", ["db", "url"], getDataFromDB); // the array defines the dependencies
registry.add("template", retrieveTemplate);
registry.add("html", ["template", "data"], renderTemplate);
```
and let the system do the job:
```js
registry.run("html", configuration, returnHTML);
```
Diogenes resolves the whole dependency tree for you, executing the services in the right order (even in parallel when possible).
Then it serves you the result on a silver platter.

A step by step example
======================

Importing diogenes
------------------
The easiest way to import Diogenes is using commonjs:
```js
var Diogenes = require('diogenes');
```
You can also import it as a global module. In that case you should take care of the dependencies (setImmediate and occamsrazor).

Creating a registry
-------------------
You can create a registry with:
```js
var registry = Diogenes.getRegistry();
```
Without arguments you create a "local registry" that is reachable within the scope of the "registry" variable.
If you pass a name to the constructor you create a global registry that is available everywhere:
```js
var registry = Diogenes.getRegistry("myregistry");
```
Defining services
-----------------
A service is defined by a name (a string), a list of dependencies (an optional list of strings) and a function with a specific interface:
```js
registry.add("text", function (config, deps, next) {
    var text = ["Diogenes became notorious for his philosophical ",
        "stunts such as carrying a lamp in the daytime, claiming to ",
        "be looking for an honest man."].join();
    next(undefined, text);
});
```
if the service is successful it passes undefined as the first argument and the result as second. The first argument will contain an exception if the service fails:
```js
registry.add("tokens", ['text'], function (config, deps, next) {
    next(undefined, deps.text.split(' '));
});
```
The array specifies a list of dependencies. This service depends on the "text" service. The deps argument will contain an attribute for every dependency
in this example: deps.text.
```js
registry.add("count", ['tokens'], function (config, deps, next) {
    next(undefined, deps.tokens.length);
});

registry.add("abstract", ['tokens'], function (config, deps, next) {
    var len = config.abstractLen;
    var ellipsis = config.abstractEllipsis;
    next(undefined, deps.tokens.slice(0, len).join(' ') + ellipsis);
});
```
The same "config" argument is passed to all services.
```js
registry.add("paragraph", ['text', 'abstract', 'count'], function (config, deps, next) {
    next(undefined, {
        count: deps.count,
        abstract: deps.abstract,
        text: deps.text
    });
});
```
This is how services relates each other:
![Registry as graph](https://cloud.githubusercontent.com/assets/460811/11994527/0fac488c-aa38-11e5-9beb-0bf455ba97cd.png)

Calling a service
-----------------
You can call a service using the method "run" with the name and the configuration (the same one will be passed as argument to all services).
```js
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
```
p will be the output of the paragraph service. If any service throws, or returns an error, the "err" argument will contain the exception.
Diogenes calls all services in order. You can get the ordering using:
```js
registry.getExecutionOrder("paragraph", {abstractLen: 5, abstractEllipsis: "..."});
```
It will return an array: ["text", "tokens", "abstract", "count", "paragraph"]
Diogenes does not strictly follow that order: "count", for example doesn't require to wait for "abstract" as it depends on "tokens" only.

Plugins
-------
A registry can have more than one service with the same name (and a different set of dependencies).
The correct service will be chosen using the configuration and an [occamsrazor validator](https://github.com/sithmel/occamsrazor.js#tutorial).
Diogenes.validator is a copy of occamsrazor.validator (for convenience). Let's say for example that you want to use a different way to get the abstract:
```js
var useAlternativeClamp = Diogenes.validator().match({abstractClamp: "chars"});

registry.add("abstract", ['text'], useAlternativeClamp, function (config, deps, next) {
    var len = config.abstractLen;
    var ellipsis = config.abstractEllipsis;
    next(undefined, deps.text.slice(0, len) + ellipsis);
});
```
You should notice that specifying a validator you are also able to use a different set of dependencies.
![Registry as graph](https://cloud.githubusercontent.com/assets/460811/11994528/0fade84a-aa38-11e5-92d2-4f4d8f60dc4d.png)

```js
registry.getExecutionOrder("paragraph", {abstractLen: 5, abstractEllipsis: "...", abstractClamp: "chars"});
```
will output: ["text", "abstract", "tokens", "count", "paragraph"].
You can run the service as usual:
```js
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
```
The key point is that you just extended the system without changing the original code!

Add a value
-----------
addValue is a short cut method you can use if a service returns always the same value (or a singleton object). And it doesn't need any configuration.
For example the "text" service can become:
```js
registry.addValue("text", ["Diogenes became notorious for his philosophical ",
        "stunts such as carrying a lamp in the daytime, claiming to ",
        "be looking for an honest man."].join());
```
Run service only once
---------------------
Some time you may want to execute a service only once and then use a more generic one:
```js
registry.addOnce("paragraph", [], Diogenes.validator().important(), function (config, deps, next) {
    next(undefined, "This runs only once");
});
```
Cache a service
---------------
If the result of a service depends on the configuration, or it is heavy to compute, you can cache it.
You can enable the cache with cacheOn, empty the cache with cacheReset or disable with cacheOff:
```js
registry.service('count').cacheOn();

registry.service('count').cacheReset();

registry.service('count').cacheOff();
```
The cacheOn method takes an object as argument with 3 different arguments:

* key: (a string/an array or a function) it generates the key to use as cache key. You can specify an attribute of the configuration (string), an nested property (array) or use a custom function running on the configuration. It default to a single key (it will store a single value)
* maxAge: the time in ms for preserving the cache. Default to infinity.
* maxSize: the length of the cache. Default to infinity

Note: a cache hit, will ever never return dependencies. After all if the service has a defined return value it doesn't need to relay on any other service.
    
Events
======
The event system allows to do something when a service is executed.
You can listen to a service in this way:
```js
registry.on('count', function (name, dep, config){
  // name is "count"
  // dep is the outout of the "count" service
  // config is the usual one used in the "run" method
});
```
The event system is implemented with occamsrazor (see the doc, especially the "mediator" example https://github.com/sithmel/occamsrazor.js#implementing-a-mediator-with-occamsrazor). So you can execute the function depending on the arguments (just pass as many validators you need).
```js
registry.on(function (name, dep, config){
  // this is executed for any service
});

registry.on("count", isLessThan5, useAlternativeClamp, function (name, dep, config){
  // this is executed for count service 
  // only if count is less than 5 and
  // the config passes the "useAlternativeClamp" validator
});

registry.on(/count.*/, function (name, dep, config){
  // this is executed for any service with the name that matches 
  // that regular expression
});

```
Be aware that events are suppressed for cached values and their dependencies! 
You can also handle the event once with "one" and remove the event handler with "off".


Dependencies
============
Diogenes depends on setimmediate and occamsrazor.

How does it work
================
A lot of the things going on requires a bit of knowedge of occamsrazor (https://github.com/sithmel/occamsrazor.js).
Basically a service is an occamsrazor adapter's registry (identified with a name). When you add a function you are adding an adapter to the registry. This adapter will return the function and the dependencies when called with the configuration as argument.
When you try running a service the first thing that happen is that diogenes will try to unwrap all the services for discovering what function/dependencies use. This is what can happen:

* the result is not defined because there is no function (or no function matching the configuration) attached to it. If this dependency is necessary it will generate an exception.
* the result is ambiguous as more than one function matches the configuration with the same validator's score. If this dependency is necessary it will generate an exception.
* the result matches a cache entry. The resulting function will return the cached value. There will be no dependencies.
* the result matches a function/dependencies

With all the services unwrapped, a dfs (depth first search) will be performed. The result will be a sorted list of services.
There will be included only a subset of the services.
At this point the system will start executing all the functions without dependencies. Every time one of these function's callback returns a value I push this in an dependency map and try to execute all the functions that see their dependencies fulfilled.
The last function should be the one I requested.

Syntax
======

Diogenes.getRegistry
--------------------
Create a registry of services:
```js
var registry = Diogenes.getRegistry();
```
or
```js
var registry = new Diogenes();
```
If you don't pass any argument this registry will be local. And you will need to reach the local variable "registry" to use its services.
If you pass a string, the registry will use a global variable to store services:
```js
var registry = Diogenes.getRegistry("myregistry");
```
or
```js
var registry = new Diogenes("myregistry");
```
This is convenient if you want any application register its services to a specific registry.

Registry's methods
==================

service
-------
Returns a single service. It creates the service if it doesn't exist.
```js
registry.service("name");
```
add
---
It adds a service to a registry. It has different signatures:
```js
registry.add(name, func);   

registry.add(name, dependencies, func);   

registry.add(name, dependencies, validator, func);   
```
* The name (mandatory) is a string. It is the name of the service. A registry can have more than one service with the same name BUT they should validate alternatively (see the validator argument).
* dependencies: it is an array of strings. Every string is the name of a service. This should be executed and its output should be pushed in the function
* validator: it is an occamsrazor validator. (https://github.com/sithmel/occamsrazor.js). You can also pass a different value as explained in the "match" validator (https://github.com/sithmel/occamsrazor.js#occamsrazorvalidatormatch);
* The function (mandatory) is a function that returns a service.

The function will have these arguments (config, deps, next):
* "config" is a value passed to all services when "run" is invoked
* "deps" is an object. It has as many properties as the dependencies of this service. The attributes of deps have the same name of the respective dependency.
* "next" is the function called with the output of this service: next(undefined, output)
* If something goes wrong you can pass the error as first argument: next(new Error('Something wrong!')). 

It returns the registry.

addValue
--------
It works the same as the add method but instead of adding a service It adds a value. This will be the dependency returned.
```js
registry.add(name, value);   

registry.add(name, dependencies, value);   

registry.add(name, dependencies, validator, value);   
```
Note: having a value you don't need dependencies. They are still part of the signature of the method for consistency.

addOnce
-------
It works the same as add but the service will be returned only one time.
```js
registry.addOnce(name, func);   

registry.addOnce(name, dependencies, func);   

registry.addOnce(name, dependencies, validator, func);   
```
addValueOnce
------------
It works the same as addValue but the service will be returned only one time.
```js
registry.addValueOnce(name, value);   

registry.addValueOnce(name, dependencies, value);   

registry.addValueOnce(name, dependencies, validator, value);   
```
remove
------
It remove a service from the registry:
```js
registry.remove(name);
```
It returns the registry.

run
---
It executes all the dependency tree required by the service and call the function. All the services are called using config:
```js
registry.run(name, config, func);
```
The function takes 2 arguments:
* an error
* the value of the service required

It returns the registry.

getExecutionOrder
-----------------
Returns an array of services that should be executed with those arguments. The services are sorted by dependencies. It is not strictly the execution order as diogenes is able to execute services in parallel if possible.
Also it will take into consideration what plugins match and caching (a cached items as no dependency!):
```js
registry.getExecutionOrder(name, config);
```

bootstrap
---------
Helper function. It runs a group of functions with the registry as "this". Useful for initializing the registry.
```js
/*module1 fir example*/
module.exports = function (){
  this.add('service1', ...);
};
/*main*/
var module1 = require('module1');
var module2 = require('module2');
registry.bootstrap([module1, module2]);
```
on
--
Attach an event handler. It triggers when an services gets a valid output. You can pass up to 3 validators and the function. The function takes 3 arguments:

* the name of the service
* the output of the service
* the config (used for running this service)

```js
registry.on([validators], function (name, dep, config){
  ...
});
```

one
---
The same as "on". The function is executed only once.

off
---
Remove an event handler. It takes the previously registered function.
```js
registry.off(func);
```

Chaining
--------
add (addValue, addValueOnce, addOnce), remove and run are chainable. So you can do for example:
```js
registry.add("service1", service1)
.add("service1", service2);
.add("myservice", ["service1", "service2"], myservice);
```
Service's methods
==================
You can get a service with the "service" method.
```js
var service = registry.service("service1");
```
All the service methods returns a service instance so they can be chained.

add
---
The same as the add registry method:
```js
service.add(func);   

service.add(dependencies, func);   

service.add(dependencies, validator, func);   
```
addValue
--------
The same as the addValue registry method:
```js
service.addValue(value);   

service.addValue(dependencies, value);   

service.addValue(dependencies, validator, value);   
```
addOnce
-------
The same as the addOnce registry method:
```js
service.addOnce(func);   

service.addOnce(dependencies, func);   

service.addOnce(dependencies, validator, func);   
```
addValueOnce
------------
The same as the addValueOnce registry method:
```js
service.addValueOnce(value);   

service.addValueOnce(dependencies, value);   

service.addValueOnce(dependencies, validator, value);   
```
remove
------
The same as the remove registry method:
```js
service.remove();   
```
run
---
The same as the run registry method:
```js
service.run(config, func);
```
cacheOn
-------
Set the cache for this service on. It takes as argument the cache configuration:
```js
service.cacheOn(config);
```
The configuration contains 3 parameters:

* key: (a string/an array or a function) it generates the key to use as cache key. You can specify an attribute of the configuration (string), an nested property (array) or use a custom function running on the configuration. It default to a single key (it will store a single value)
* maxAge: the time in ms for preserving the cache. Default to infinity.
* maxSize: the length of the cache. Default to infinity

cacheOff
--------
It empties and disable the cache.

cacheReset
----------
It empties the cache.

on/one/off
----------
Manage event handlers. It is a alternate syntax to the registry ones.
```js
registry.service(name).on([validators], function (name, dep, config){
  ...
});

registry.service(name).one([validators], function (name, dep, config){
  ...
});

registry.service(name).off(func);
```

Exceptions
==========
The library is currently able to detect and throws exceptions in a few cases:

* circular dependencies
* missing dependencies (or incompatible plugin)
* more than one plug-in matches (using a validator)
* the service returns or throws an exception

The first 3 exceptions can be thrown by "getExecutionOrder" and "run".
The last one only using "run".

Tricks and tips
===============

Avoid mutations
---------------
Do not mutate the config and deps arguments! It will lead to unpredictable bugs. Clone the object instead.

