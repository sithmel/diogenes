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
A service is a unit of code with a name. It can be a simple value, a synchronous function (returning a value) or an asynchronous function returning a promise.
It takes as argument an object containing the dependencies (output of other services).

A service outputs a "dependency", this is identified with the service name.
Services are organised inside a registry. The common interface allows to automate how the dependencies are resolved within the registry.

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
const registry = Diogenes.getRegistry(); // or new Diogenes()
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
As you can see, Diogenes allows to mix sync and async functions.

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
p will be the output of the paragraph service.

When resolving a dependency graph, diogenes takes care of executing every service at most once.
If a service returns or throws an exception, this is propagated along the execution graph. Services getting an exception as one of the dependencies, are not executed.

Docstring
=========
A docstring is the description of the service. That may help using diogenes-lantern, a tool that shows your registry with a graph.
You can set a docstring like this:
```js
registry
  .service('service1')
  .doc('this is some helpful information')
```
And you can retrieve a docString with:
```js
registry
  .service('service1')
  .doc()
```

registry-runner
===============
Registry runner is an object that takes care of running services. This adds many features to a simple registry. You can create a runner like this:
```js
const registryRunner = Diogenes.getRegistryRunner()
```
then you can run a service with:
```js
registryRunner.run(registry, 'myservice')
```
Registry runner allows to use callbacks:
```js
registryRunner.run(registry, 'myservice', (err, myservice) => {
  ...
})
```
The callback uses the node.js convention, the error is the first argument.

Another feature allows to execute multiple services efficiently using an array or a regular expression:
```js
registryRunner.run(registry, /myservice[1-3]/)
```
or the equivalent:
```js
registryRunner.run(registry, ['myservice1', 'myservice2', 'myservice3'])
```
The result will be an object with an attribute for every dependency.

Using this feature is different to:
```js
Promise.all([registry.run('myservice1'), registry.run('myservice2'), registry.run('myservice3')])
```
Because it ensures that every service is executed at most once.

You can also use the same method to add services without dependencies, without changing the original registry:
```js
registryRunner.run(registry, 'myservice', { times: 3 })
```
So if a service depends on "times", it will get 3. This can be useful for testing (injecting a mock in the dependency graph).
It is also useful to give an "execution context" that is different every time (think for example the request data in a web application).

The registry runner keeps track of all pending execution so is able to gracefully shutdown:

```js
registryRunner.shutdown()
  .then(() => {
    console.log('We can shutdown')
  })

registryRunner.run('myservice1') // this return a promise rejection because the registry is not accepting new tasks
```

Registry and decorators
=======================
[The decorator pattern](https://en.wikipedia.org/wiki/Decorator_pattern) can be very useful to enhance a service. For example adding a caching layer, logging or to convert a callback based service to use a promise (promisify is a decorator).
The method "provides" includes a shortcut to add decorators to the service. If you pass an array or more than one argument, to the method. In the next example I am able to add a service that uses a callback instead of promises:
```js
registry.service('myservice')
  .provides([
    promisify,
    (deps, next) => {
      .. do something
      next(null, result)
    }])
```
In the next example I use a decorator to ensure a service is executed only once:
```js
// define my decorator
const onlyOnce = (func) => {
  let cache
  return (deps) => {
    if (typeof cache === 'undefined') {
      cache = func(deps)
    }
    return cache
  }  
}

registry.service('myservice')
  .provides([
    onlyOnce,
    (deps) => {
      ...
    }])
```
You can add multiple decorators:
```js
registry.service('myservice')
  .provides([logger, onlyOnce, myservice])
```
This is the equivalent of:
```js
registry.service('myservice')
  .provides(logger(onlyOnce(myservice)))
```
You can find many examples of what you can do with decorators on [async-deco](https://github.com/sithmel/async-deco) and on [diogenes-utils](https://github.com/sithmel/diogenes-utils). This one in particular, contains a decorator that caches a service.
```js
const cacheService = require('diogenes-utils').cacheService
registry.service('myservice')
  .provides([
    cacheService({ len: 3, ttl: 10000 }),
    myservice
  ])
```

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

Diogenes.getRegistryRunner
--------------------
Create a registry runner instance:
```js
const registry = Diogenes.getRegistryRunner();
```

Registry
========

service
-------
Returns a single service. It creates the service if it doesn't exist.
```js
registry.service("name");
```

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

merge/clone
-----------
It allows to create a new registry, merging services of different registries:
```js
const registry4 = registry1.merge(registry2, registry3)
```
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

missingDeps
-----------
This method returns an array of service names that are not in the registry, but are dependencies of another service.
This can be useful for debugging.

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

Service
=======
You can get a service from the registry with the "service" method.
```js
const service = registry.service('service1');
```
All the service methods returns a service instance so they can be chained.

dependsOn
---------
It defines the dependencies of a service. It may be an array or an object:
```js
service.dependsOn([...]);

service.dependsOn({...});
```
Using an object you can use the dependencies under different names. For example, this are equivalent:
```js
service.dependsOn(['A', 'B']);
service.dependsOn({ A: 'A', B: 'B' });
```
You can use the object like this:
```js
service.dependsOn({ value: 'A' })
  .provides(({ value }) => return value * 2);
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
Or a synchronous function:
```js
service.provides((deps) => deps.something * 2);
```
If you pass an array or more than one argument, the first arguments are used to decorate the others:
```js
service.provides(arg1, arg2, arg3, arg4);
// is the equivalent of
service.provides(arg1(arg2(arg3(arg4))));
```

doc
---
get/set the documentation string.
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

Registry Runner
===============
This object runs services, keeping track of their execution.

run
---
This method runs one or more services:
```js
registryRunner.run(service, 'servicename')
```
by default it returns a promise but can also use a callback (using the node convention):
```js
registryRunner.run(service, 'servicename', (err, res) => { ... })
```
you can run multiple services using a regular expression or an array of names.

You can also pass an object with some extra dependencies to be used for this execution:
```js
registry.run('service2', { service1: 'hello' })
  .then(({ service2 }) => {
    ...
  })
```
The extra dependencies won't be added to the original registry.

shutdown
--------
The purpose of this method is to allow all asynchronous call to be terminated before a system shutdown.
After calling this method the registry runner won't execute the "run" method anymore (It will return an exception). The method returns a promise (or uses a callback). This will be fulfilled when all previous "run" has been fulfilled of rejected.
```js
registryRunner.run(registry, 'A')
registryRunner.run(registry, 'C')

registry.shutdown()
  .then(() => {
    // "A" and "C" are fulfilled
  })
registryRunner.run(registry, 'A')  // rejected with DiogenesShutdownError
```

flush
-----
Flush runs a shutdown and then restore the registry to its normal state.

Compatibility
=============
Diogenes is written is ES6. Please transpile it for using with old browsers/node.js. Also provide a polyfill for Promises, WeakMaps and Sets.

Acknowledgements
================
Diogenes won't be possible without the work of many others. The inspiration came from many different patterns/libraries. In particular I want to thank you:
* [architect](https://github.com/c9/architect) for introducing the idea of initialising a system using the dependency injection pattern
* [electrician](https://github.com/tes/electrician) that explored a way to wrap the code in "components" having a common interface, that is a prerequisite of having them working together
