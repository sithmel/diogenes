Diogenes
========
[![Build Status](https://travis-ci.org/sithmel/diogenes.svg?branch=master)](https://travis-ci.org/sithmel/diogenes)
[![dependency Status](https://david-dm.org/sithmel/diogenes.svg)](https://david-dm.org/sithmel/diogenes.svg)

![Registry as graph](https://upload.wikimedia.org/wikipedia/commons/b/b6/Diogenes_looking_for_a_man_-_attributed_to_JHW_Tischbein.jpg)
> When asked why he went about with a lamp in broad daylight, Diogenes confessed, "I am looking for a [honest] man."

Diogenes helps to use the dependency injection pattern to split your application into reusable and testable components.

Dependency injection
--------------------
The [dependency injection pattern](https://en.wikipedia.org/wiki/Dependency_injection) is a widely used design pattern. Simply put, allows to build complicated abstractions composed by simpler abstractions. The composition happens when you "inject" one or more dependency into a function:
```js
const database = getDB(config.db);
const passwordHashing = getPasswordHashing(config.secret);
const users = getUsers(database, passwordHashing);
```
I call this progressively complex objects "services" as they provide a specific functionality.

While this is a very nice way to build an application, it will leave the developer with a lot of annoying problems:
* dealing with the boilerplate needed to create your services only when you need to (no need to rebuild a new "users" service in every module you need to use it)
* some service might return asynchronously
* you have to figure out and maintain the correct order for resolving the dependencies
* you have to manage errors step by step

Diogenes lets you design how these components interact between them, in an declarative way.

You declare your "services" and their dependencies:
```js
const Diogenes = require('diogenes');
const registry = Diogenes.getRegistry();

registry.service('database').provides(getDB);
registry.service('passwordHashing').provides(getPasswordHashing);

registry.service('users')
  .dependsOn(['database', 'passwordHashing'])
  .provides(getUsers);
```
and then get the service you need:
```js
registry
  .run('users')
  .then((users) => {
    ...
  })
```
Diogenes figures out the execution order, manages error propagation, deals with synchronous and asynchronous functions transparently and much more.

What is a service
-----------------
A service is a unit of code with a name. It can be a simple value, a synchronous function (returning a value), an asynchronous function using a callback or an asynchronous function returning a promise.
It takes as argument an object containing the dependencies (output of other services).
Optionally you can pass a callback.

A service outputs a "dependency", this is identified with the service name.
Services are organized inside a registry. The common interface allows to automate how the dependencies are resolved within the registry.

A step by step example
======================

Importing diogenes
------------------
You can import Diogenes using commonjs:
```js
const Diogenes = require('diogenes');
```

Creating a registry
-------------------
You can create a registry with:
```js
const registry = Diogenes.getRegistry(); // of new Diogenes()
```

Defining services
-----------------
A service is defined by a name (a string) and it can be as simple as a value:
```js
registry.service("text")
  .provides(`Diogenes became notorious for his philosophical
    stunts such as carrying a lamp in the daytime, claiming to
    be looking for an honest man.`);
```
most of the time you will define a service as a function:
```js
registry
  .service("text")
  .provides((deps) => fs.readFileSync(deps.config.path, {encoding: 'utf8'}));
```
If the function is asynchronous you can return a promise. It will work transparently:
```js
const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);

registry
  .service("text")
  .provides((deps) => readFile('diogenes.txt', {encoding: 'utf8'}));
```
or you can use a callback:
```js
registry.service("text")
  .provides((deps, next) => {
    fs.readFile('diogenes.txt', {encoding: 'utf8'}, next);
  });
```
The callback should use the node.js convention: the first argument is the error instance (or null if there isn't any) and the second is the value returned.
As you can see, Diogenes allows to mix sync and async (callback and promise based) functions. How cool is that?
Let's add other services:
```js
registry.service("tokens")
  .dependsOn(['text'])
  .provides(({ text }) => text.split(' '));
```
The method "dependsOn" allows to specify a list of dependencies. For example this service depends on the "text" service. The deps argument is an object containing an attribute for every dependency, in this example: deps.text.
```js
registry.service("count")
  .dependsOn(['tokens'])
  .provides(({ tokens }) => tokens.length);

registry.service("abstract")
  .dependsOn(['tokens'])
  .provides(({ tokens }) => tokens.slice(0, 20).join(' ') + '...');

registry.service("paragraph")
  .dependsOn(['text', 'abstract', 'count'])
  .provides(({ text, abstract, count }) => ({text, abstract, count}));
```
This is how services relates each other:
![Registry as graph](https://cloud.githubusercontent.com/assets/460811/11994527/0fac488c-aa38-11e5-9beb-0bf455ba97cd.png)

Calling a service
-----------------
You can call a service using the method "run" on a registry.
```js
registry.run('paragraph')
  .then((p) => {
    console.log("This paragraph is " + p.count + " words long");
    console.log("The abstract is: " + p.abstract);
    console.log("This is the original text:");
    console.log(p.text);            
  })
  .catch((err) => console.log(err.message))
```
p will be the output of the paragraph service. You can alternatively pass a callback to "run".
```js
registry.run('paragraph', (err, p) => {
  if (err) {
    console.log(err.message)
    return;
  }
  console.log("This paragraph is " + p.count + " words long");
  console.log("The abstract is: " + p.abstract);
  console.log("This is the original text:");
  console.log(p.text);            
})
```

If you need more than one service, you can pass a list of services:
```js
registry.run(["count", "abstract"])
  .then({ count, paragraph } => {
    ...
  })
```
In this case the result will be an object with an attribute for each dependency (deps.count, deps.abstract).

Errors
======
If a service returns or throws an exception, this is propagated along the execution graph. Services getting an exception as one of the dependencies, are not executed.

Using function references
=========================
"service" and "dependsOn" allow to use function references instead of strings (the functions should have a name!):
```js
registry
  .service(function service2 (deps) {
    // ... function implementation ...
  })
  .dependsOn([service2]);
```
is equivalent to:
```js
registry
  .service('service2')
  .provides((deps) => {
    // ... function implementation ...
  })
  .dependsOn(['service2']);
```

Docstring
=========
You can define a docstring in 2 ways:
```js
registry
  .service('service1')
  .doc('this is some helpful information')
```
or
```js
registry
  .service(function service1(deps) {
    /**
    this is some helpful information
    **/
  })
```
And you can retrieve a docString with:
```js
registry
  .service('service1')
  .doc()
```
Docstrings can be used to store info about services.

Syntax
======

Diogenes.getRegistry
--------------------
Create a registry of services:
```js
const registry = Diogenes.getRegistry();
```
or
```js
const registry = new Diogenes();
```

Registry
========

service
-------
Returns a single service. It creates the service if it doesn't exist.
```js
registry.service("name");
```
You can also pass a function (a named function!):
```js
registry.service(name);
```
Passing a function is equivalent to both defining a service and providing an implementation.

init
----
Helper function. It runs a group of functions with the registry as first argument. Useful for initializing the registry.
```js
/* module1 for example */
module.exports = (registry) => {
  registry.service('service1').provides(...);
};
/* main */
const module1 = require('module1');
const module2 = require('module2');
registry.init([module1, module2]);
```

run
---
It executes all the dependency tree required by a service and return a promise that will resolve to the service itself.
```js
registry.run(serviceName)
  .then((service) => {
    ...
  });
```
It can also use a callback:
```js
registry.run(serviceName, (err, service) => {
  ...
});
```
The callback uses the node convention (error as first argument).

You can also execute more than one service passing an array of names:
```js
registry.run(['service1', 'service2'])
  .then(({ service1, service2 }) => {
    ...
  })
```
or using a regular expression:
```js
registry.run(/service[0-9]?/)
  .then(({ service1, service2 }) => {
    ...
  })
```
You can also pass an object with some extra dependencies to be used for this execution:
```js
registry.run('service2', { service1: 'hello' })
  .then(({ service1, service2 }) => {
    ...
  })
```

merge/clone
-----------
It allows to create a new registry, merging services of different registries:
```js
const registry4 = registry1.merge(registry2, registry3)
```
The state of of services will be preserved. So for example, if a service has already been successfully executed, this won't be executed again.
Calling merge without argument, creates a clone.

getAdjList
----------
It returns the adjacency list in the following format:
```js
/*
A ----> B
|     / |
|    /  |
|   /   |
|  /    |
| /     |
VV      V
C ----> D
*/

registry.getAdjList();
/* returns
{
  'A': [],
  'B': ['A'],
  'C': ['A', 'B'],
  'D': ['B', 'C']
}
*/
```
As an optional argument you can pass an object with some extra dependencies.

getMetadata
------------
It returns the metadata of all services:
```js
registry.getMetadata();
/* returns
{
  'A': {
    name: 'A', // service name
    deps: [], // list of deps
    doc: '...', // service documentation string
    debugInfo: {
      fileName: ... // file name where service is defined
      line: ..., // line of code where the service is defined
      functionName: ..., // service function name (if defined)
      parentFunctionName: ..., // the function containing the service definition
    }
  },
  ...
}
*/
```
As an optional argument you can pass an object with some extra dependencies.

shutdown
--------
The purpose of this method is allow all asynchronous call to be terminated before a system shutdown.
After calling this method the service won't execute the "run" method anymore (It will return an exception). The method returns a promise (or a callback). This will be fulfilled when all previous "run" has been fulfilled of rejected.
```js

const A = registry.run('A')
const C = registry.run('C')
registry.shutdown()
  .then(() => {
    // "A" and "C" are fulfilled
    registry.run('B') // rejected with DiogenesShutdownError
  })
```

Service
=======
You can get a service from the registry with the "service" method.
```js
const service = registry.service('service1');
```
All the service methods returns a service instance so they can be chained.

dependsOn
---------
It defines the dependencies of a service. It may be an array or a function returning an array of strings (service names) or an array of functions:
```js
service.dependsOn(array);

service.dependsOn(func);
```

provides
--------
You can pass a function taking a dependencies object as argument, and returning a promise.
```js
service.provides((deps) => ...);
```
You can also pass any "non function" argument:
```js
service.provides(42); // Any non function argument
```
A synchronous function:
```js
service.provides((deps) => deps.something * 2);
```
Or callback:
```js
service.provides((deps, callback) => callback(null, deps.something * 2));
```
The "callback" behaviour is triggered by the extra argument "callback". Do not add that argument if you are not using the callback. Callbacks use the node convention of having the error as first argument and the result as second.
When you pass a function to "provides", the first argument of this function is always a object with an attribute for every dependency.

doc
---
set/get the documentation string.
```js
service.doc(); // returns documentation string
service.doc('... service description ...'); // set the doc string
```

getMetadata
------------
It returns the metadata of this service:
```js
service.getMetadata();
/* returns
{
  name: 'A', // service name
  deps: [], // list of deps
  doc: '...', // service documentation string
  debugInfo: {
    fileName: ... // file name where service is defined
    line: ..., // line of code where the service is defined
    functionName: ..., // service function name (if defined)
    parentFunctionName: ..., // the function containing the service definition
  }
}
*/
```

Compatibility
=============
Diogenes is written is ES6. Please transpile it for using with old browsers/node.js. Also provide a polyfill for Promises and WeakMaps.

Acknowledgements
================
Diogenes won't be possible without the work of many others. The inspiration came from many different patterns/libraries. In particular I want to thank you:
* [architect](https://github.com/c9/architect) for introducing the idea of initialising a system using the dependency injection pattern
* [electrician](https://github.com/tes/electrician) that explored a way to wrap the code in "components" having a common interface, that is a prerequisite of having them working together
