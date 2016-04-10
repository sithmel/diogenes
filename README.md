Diogenes
========
[![Build Status](https://travis-ci.org/sithmel/diogenes.svg?branch=master)](https://travis-ci.org/sithmel/diogenes)
[![dependency Status](https://david-dm.org/sithmel/diogenes.svg)](https://david-dm.org/sithmel/diogenes.svg)

![Registry as graph](https://upload.wikimedia.org/wikipedia/commons/b/b6/Diogenes_looking_for_a_man_-_attributed_to_JHW_Tischbein.jpg)
> When asked why he went about with a lamp in broad daylight, Diogenes confessed, "I am looking for a [honest] man."

Diogenes defines and executes functions with a common interface (services) sorting out the execution order automatically (by dependency).

From functions to services
--------------------------
Let's say that you have a function returning an html page. You usually need to execute a certain number of steps (already incapsulated into functions):
```js
decodeURL(url, function (err, id){
  if (err) {
    returnHTML('Error');
  }
  getDB(config, function (err, db){
    if (err) {
      returnHTML('Error');
    }
    getDataFromDB(db, id, function (err, obj){
      if (err) {
        returnHTML('Error');
      }
      retrieveTemplate(templateName, function (err, template){
        if (err) {
          returnHTML('Error');
        }
        renderTemplate(template, obj, function (err, html){
          if (err) {
            returnHTML('Error');
          }
          else {
            returnHTML(html)            
          }
        });
      });
    });
  });
});
```
Well, I can see more than one issue here. The first one, usually called "the pyramid of doom", can be partially solved using promises:
```js
Promise.all([ // <- this executes 2 blocks in parallel
  decodeURL(url)
    .then(function (id) {
      return getDB(config)
        .then(function (db) {
          return getDataFromDB(db, id);
        })
    }),
  retrieveTemplate(templateName)
])
  .then(function (results) {
    var obj = results[0],
        template = results[1];
    return renderTemplate(obj, template);
  })
  .then(function (html) {
    returnHTML(html);
  })
  .catch(function () {
    return returnHTML(err);
  });
```
This second version is not only more concise but is also much more efficient as it executes some operations in parallel. Also automatic propagation of errors is a very cool feature!
But still is not perfect: handling the passage of values can be clumsy, swallowing exception when you forgot the catch can be dangerous, mixing promises and callback annoying ...
But there is a worst issue, you are designing how the components interact between them, in an imperative way. Wouldn't it better if the system could figure out the execution order ? Even better working flawlessly with promises, synchronous functions and callbacks ?

With Diogenes you can describe the flow of informations in terms of services, describing the relations between them:
```js
var Diogenes = require('diogenes');
var registry = Diogenes.getRegistry();

registry.service("id").provides(decodeURL);
registry.service("db").provides(getDB);
registry.service("data")
  .dependsOn(["db", "url"])
  .provides(getDataFromDB);
registry.service("template").provides(retrieveTemplate);
registry.service("html")
  .dependsOn(["template", "data"])
  .provides(renderTemplate);
```
and let the system do the job:
```js
registry
  .instance(config)
  .run("html", returnHTML);
```
Diogenes resolves the whole dependency tree for you, executing the services in the right order (even in parallel when possible).
Then it serves you the result on a silver platter.

What is a service
-----------------
A service is a unit of code with a name. It can be a simple value, a synchronous function (returning a value), an asynchronous function using a callback or an asynchronous function returning a promise.
As a function, it has a specific interface. Its arguments are:

* a configuration, common to all services
* an object containing the dependencies (output of other services)
* an optional callback (if the function needs it)

A service outputs a "dependency", this is identified with the service name.
Services are organized inside a registry. The common interface allows to automate how the dependencies are resolved within the registry.

A step by step example
======================

Importing diogenes
------------------
You can import Diogenes using commonjs:
```js
var Diogenes = require('diogenes');
```

Creating a registry
-------------------
You can create a registry with:
```js
var registry = Diogenes.getRegistry(); // of new Diogenes()
```

Defining services
-----------------
A service is defined by a name (a string) and it can be as simple as a value:
```js
registry.service("text").returnsValue(["Diogenes became notorious for his philosophical ",
    "stunts such as carrying a lamp in the daytime, claiming to ",
    "be looking for an honest man."].join());
```
most of the time you will define a service as a function:
```js
registry.service("text").returns(function (config, deps) {
  var text = fs.readFileSync(config.path, {encoding: 'utf8'});
  return text;
});
```
The "config" argument is a generic configuration used for all services.
The "returns" method can be used for synchronous functions, but it works even if you return promises!
You can also define a service using a callback:
```js
registry.service("text").provides(function (config, deps, next) {
  fs.readFile(config.path, {encoding: 'utf8'}, next);
});
```
The callback uses the node.js convention: the first argument is the error instance (or null if there isn't any) and the second is the value returned.
For synchronous functions you can throw an exception in case of errors as usual.
As you can see, Diogenes allows to mix sync and async (callback and promise based) functions. How cool is that?
Let's add other services:
```js
registry.service("tokens")
  .dependsOn(['text'])
  .returns(function (config, deps) {
  return deps.text.split(' ');
});
```
The method "dependsOn" allows to specify a list of dependencies. For example this service depends on the "text" service. The deps argument will contain an attribute for every dependency,
in this example: deps.text.
```js
registry.service("count")
  .dependsOn(['tokens'])
  .returns(function (config, deps) {
  return deps.tokens.length;
});

registry.service("abstract")
  .dependsOn(['tokens'])
  .returns(function (config, deps) {
  var len = config.abstractLen;
  var ellipsis = config.abstractEllipsis;
  return deps.tokens.slice(0, len).join(' ') + ellipsis;
});

registry.service("paragraph")
  .dependsOn(['text', 'abstract', 'count'])
  .returns(function (config, deps) {
    return {
        count: deps.count,
        abstract: deps.abstract,
        text: deps.text
    };
  });
```
This is how services relates each other:
![Registry as graph](https://cloud.githubusercontent.com/assets/460811/11994527/0fac488c-aa38-11e5-9beb-0bf455ba97cd.png)

Calling a service
-----------------
You can call a service using the method "run" on a registry instance. The instance "method" returns a registry instance using a specific configuration.
```js
var registryInstance = registry.instance({abstractLen: 5, abstractEllipsis: "..."});

registryInstance.run("paragraph", function (err, p){
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
If you need more than one service, you can pass a list of services:
```js
registryInstance.run(["count", "abstract"], function (err, deps){
  ...
});
```
In this case the second argument will contain an object with an attribute for each dependency (deps.count, deps.abstract).
Using "run", Diogenes calls all services required to satisfy the dependencies tree. You can get the ordering using:
```js
registryInstance.getExecutionOrder("paragraph", function (err, dependencies) {
  //
});
```
It will return an array: ["text", "tokens", "abstract", "count", "paragraph"]
Diogenes does not strictly follow that order: "count", for example doesn't require to wait for "abstract" as it depends on "tokens" only.

Plugins
-------
A service can contain more than one function, and more than one set of dependencies.
Let's say for example that you want to use a different way to get the abstract:
```js
var validator = require('occamsrazor-validator');
var useAlternativeClamp = validator().match({abstractClamp: "chars"});

registry.service("abstract")
  .dependsOn(useAlternativeClamp, ['text'])
  .provides(useAlternativeClamp, function (config, deps, next) {
    var len = config.abstractLen;
    var ellipsis = config.abstractEllipsis;
    next(undefined, deps.text.slice(0, len) + ellipsis);
  });
```
"useAlternativeClamp" is an [occamsrazor validator](https://github.com/sithmel/occamsrazor-validator).

The "dependsOn" method can take one validator. If it matches the config, this different set of dependencies will be used.
The "provides", "returns" and "returnsValue" methods can take 2 validators. The first one will match the config, the second the dependencies.
So you can change on the fly which function use depending on the arguments (config and deps).

![Registry as graph](https://cloud.githubusercontent.com/assets/460811/11994528/0fade84a-aa38-11e5-92d2-4f4d8f60dc4d.png)

```js
var registryInstance = registry.instance({abstractLen: 5, abstractEllipsis: "...", abstractClamp: "chars"});

registryInstance.getExecutionOrder("paragraph", function (err, dependencies) {
  // ....
});
```
will output: ["text", "abstract", "tokens", "count", "paragraph"].
You can run the service as usual:
```js
registryInstance.run("paragraph", function (err, p){
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

Caching a service
-----------------
If the result of a service depends on the configuration and it is heavy to compute, you can cache it.
The "cache" method takes an object as argument with 3 different attributes:

* key: (a function) it generates the key to use as cache key. It default to a single key (it will store a single value)
* maxAge: the time in ms for preserving the cache. Default to infinity.
* maxLen: the length of the cache. Default to infinity

Note: a cached service, when using the cached value, it will return no dependencies. After all if the service has a defined return value it doesn't need to relay on any other service.
So for example:
```js
registry.service('count')
.cache({
  key: function (config){
    return config.abstractLen;
  },
  maxAge: 1000
});
```
The "cache" methods can also take as argument a [memoize-cache](https://github.com/sithmel/memoize-cache) object:
```js
var Cache = require('memoize-cache/ram-cache');

var cache = new Cache({
    key: function (config){
      return config.abstractLen;
    },
    maxAge: 1000
  });

registry.service('count').cache(cache);
```
This is very convenient as it allows to manage the cache and even use different back ends (redis or file system for example).

Errors
======
If a service returns or throws an exception, this is propagated along the execution graph. Services getting an exception as one of the dependencies, are not executed. They will propagate the exception to the services depending on them.

Syntax ////////
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

instance
--------
Returns a an registryInstance object. It is a registry with a configuration and it is used to run services.
```js
registry.instance(config, options);
```
The config argument will be passed to all services (calling the run method). Currently there are 2 options:
* limit: limit the number of services executed in parallel (defaults to Infinity)
* debug: enable some profiling and debugging informations. They are passed as third and fourth arguments of the run callback.

remove
------
It remove a service from the registry:
```js
registry.remove(name);
```
It returns the registry.

init
----
Helper function. It runs a group of functions with the registry as "this". Useful for initializing the registry.
```js
/*module1 fir example*/
module.exports = function (){
  this.add('service1', ...);
};
/*main*/
var module1 = require('module1');
var module2 = require('module2');
registry.init([module1, module2]);
```

forEach
-------
It runs a callback for any service registered.
```js
registry.forEach(function (service, name){
  // the service is also "this"
});
```

on
--
Attach an event handler. It triggers when an services gets a valid output. You can pass up to 4 validators and the function. The function takes 4 arguments:

* the type of event (before, success, error, cachehit)
* the name of the service
* the output of the service (not for the "before" type)
* the config (used for running this service)

```js
registry.on([validators], function (type, name, dep, config){
  ...
});
```
Types of events:
* before: fires before starting executing a service. It doesn't fire for cached services. Arguments: (type, name, config)
* success: fires after returning a value from a service. Arguments: (type, name, dep, config)
* error: fires after returning an error from a service. Arguments: (type, name, err, config)
* cachehit: fires on cached services. Arguments: (type, name, dep, config)

one
---
The same as "on". The function is executed only once.

off
---
Remove an event handler. It takes the previously registered function.
```js
registry.off(func);
```

trigger
-------
Trigger an event. You can use trigger with a bunch of arguments and, all handlers registered with "on" and "one" compatible with those will be called.

Service's attributes
====================

* name: the name of the service (cannot be changed)

Service's methods
==================
You can get a service from the registry with the "service" method.
```js
var service = registry.service("service1");
```
All the service methods returns a service instance so they can be chained.

provides
--------
It adds a function to the service:
```js
service.provides(func);

service.provides(configValidator, func);

service.provides(configValidator, dependenciesValidator, func);
```
The function can have 2 different signatures: with callback (config, deps, next) or without (config, deps):
* "config" is a value passed to all services when "run" is invoked
* "deps" is an object. It has as many properties as the dependencies of this service. The attributes of deps have the same name of the respective dependency.
* "next" is the function called with the output of this service: next(undefined, output).
* If something goes wrong you can pass the error as first argument: next(new Error('Something wrong!')).
If you use the signature without "next" you can return the value using return, or throw an exception in case of errors. If you return a promise (A or A+) this will be automatically used.
The "this" symbol will be the service itself.
configValidator and dependencyValidator are occamsrazor validators. (https://github.com/sithmel/occamsrazor.js). You can also pass a value as explained in the "match" validator (https://github.com/sithmel/occamsrazor.js#occamsrazorvalidatormatch).
They matches respectively the first and second argument of the function.

returns
-------
It works the same as the "provides" method but instead of adds a function it adds a value. This will be the dependency returned.
```js
service.returns(value);

service.returns(configValidator, value);

service.returns(configValidator, dependencyValidator, value);
```

dependsOn
---------
It defines the dependencies of a service. It may be an array or a function returning an array. The function takes "config" as argument:
```js
service.dependsOn(array);

service.dependsOn(func);

service.dependsOn(configValidator, array);

service.dependsOn(configValidator, func);
```

onErrorReturn
-------------
If the service or one of the dependencies fails (thrown an exception) it returns "value" as fallback.
```js
service.onErrorReturn(value);
```

onErrorExecute
--------------
If the service or one of the dependencies fails (thrown an exception) it uses the function to calculate a fallback. The arguments are the configuration and the error. You can propagate the exception returning the error.
```js
service.onErrorExecute(function (config, err){
  return ...;
});
```

onErrorThrown
-------------
It reverts to the default behaviour: on error it propagates the error.
```js
service.onErrorThrown();
```

onErrorUseCache
---------------
In case of error uses the last valid cached value. It uses a different cache bucket from the one used for the normal cache (the configuration is the same as the cacheOn method). Usually you want to specify longer times for this cache to expire. Its content is used only in case of errors.
```js
service.onErrorUseCache(config);
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

metadata
--------
Get/set metadata on the service.
```js
registry.service(name).metadata(metadata); // set
registry.service(name).metadata(); // get
```
description
-----------
Get/set a service description.
```js
registry.service(name).description(metadata); // set
registry.service(name).description(); // get
```

info
----
It returns a documentation of the service. It requires a configuration to resolve the dependencies.
```js
registry.service(name).info(config);
```

infoObj
-------
It returns an object with a lot of information about the service. It requires a configuration to resolve the dependencies.
```js
registry.service(name).infoObj(config);
```

RegistryInstance's methods
=======================
This object is returned with the "instance" registry method.

info
----
It returns a documentation of all services.
```js
registryInstance.info();
```

infoObj
-------
It returns an object with a lot of information about the services.
```js
registryInstance.infoObj();
```

getExecutionOrder
-----------------
Returns an array of services that should be executed with those arguments. The services are sorted by dependencies. It is not strictly the execution order as diogenes is able to execute services in parallel if possible.
Also it will take into consideration what plugins match and the caching (a cached items as no dependency!):
```js
registryInstance.getExecutionOrder(name);
```

run
---
It executes all the dependency tree required by the service and call the function. All the services are called using the configuration used in the method "instance":
```js
registryInstance.run(name, func);
```
The function takes 2 arguments:
* an error
* the value of the service required

You can also use the alternative syntax:
```js
registryInstance.run(names, func);
```
In this case "names" is an array of strings (the dependency you want to be returned).
The callback will get as second argument an object with a property for any dependency returned.

The context (this) of this function is the registry itself.

It returns the registry instance.

Errors in the services graph
============================
The library is currently able to detect and throws exceptions in a few cases:

* circular dependencies
* missing dependencies (or incompatible plugin)
* more than one plug-in matches

These 3 exceptions are thrown by "getExecutionOrder". So it is very useful using this method to check if something is wrong in the graph configuration.

Tricks and tips
===============

Where to apply side effects
---------------------------
Do not mutate the configuration argument! It is not meant to be changed during the execution. Instead you can apply side effects through a dependency. See the example of the expressjs middleware below.

Run a service defined in a closure
----------------------------------
If you need to run a service that depends on some variable defined in a closure you can use this trick: define a local registry containing the "local" dependencies, merge together the main and the local registry (a new merged registry will be generated), run the service. This is an example using an expressjs middleware:
```js
var express = require('express');
var app = express();
var Diogenes = require('diogenes');
var registry = new Diogenes();

registry.service('hello')
  .dependsOn(['req', 'res'])
  .provides(function (config, deps, next){
  var username = deps.req.query.username;
  deps.res.send('hello ' + username);
  next();
});

app.get('/', function(req, res){
  var localReg = new Diogenes();
  localReg.services('req').returns(req);
  localReg.services('res').returns(res);
  registry.merge(localReg).run('hello');
});

app.listen(3000);
```

Using events for intra service communication
--------------------------------------------
All functions added using "provides" have as "this" the service object itself. So they can easily access to all service's methods and registry methods using "this.registry()".

This simplify the case in which you want:

* manipulate the cache of a service (reset for example)
* communicate between services using the event system
* run another service

Example:
```js
var c = 0;
registry.service('counter-button').provides(function (config, deps, next){
  var registry = this.registry();
  document.getElementById('inc').addEventListener("click", function (){
    c++;
    console.log(c);
  });
  registry.on("reset-event", function (){
    c = 0;
  });
  next();
});

registry.service('reset-button').provides(function (config, deps, next){
  var registry = this.registry();
  document.getElementById('reset').addEventListener("click", function (){
    registry.trigger("reset-event");
  });
  next();
});

registry.run(['counter-button', 'reset-button']);
```

The callback in the "run" method instead uses as "this" the registry itself.
Another example: a service requires to do some clean up after its execution. In this case you can leverage the event system:
```js
var registry = new Diogenes();
...
registry.service('database-connection').provides(function (config, deps){
  var connection = ..... I get the connection here

  this.registry().on('done', function (){
    connection.dispose();
  });
  next();
});

registry.run('main-service', function (err, dep){
  ...
  this.trigger('done');
});
```
