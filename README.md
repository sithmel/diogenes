Diogenes
========

Diogenes is a services registry.

Components and services
=======================
While components is an entity (simple value or object) returned by a function, a service is formed by many interdependent components.
Let's say for example that I have a function returning an html page. For getting this I usually need to execute a certain number of steps that I have already incapsulated into functions:

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
Well I can see more than one issue here. The first one, the pyramid of doom, can be solved easily using promises (or other techniques).
But there is a worst issue, you are designing the workflow, how the components interact between them in an imperative way.
This is impossible to extend and you'll finish use the same patterns again and again.

Using Diogenes you can describe the components in terms of relations between them:

    var Diogenes = require('diogenes');
    var registry = Diogenes.getRegistry();

    registry.addService("id", decodeURL);
    registry.addService("db",  getDB);
    registry.addService("data", ["db", "url"], getDataFromDB); // the array defines the dependencies
    registry.addService("template", retrieveTemplate);
    registry.addService("html", ["template", "data"], renderTemplate);

and let the system do the job:

    registry.getService("html", configuration, returnHTML);

It resolves all the dependency tree for you, executing the components in the right order (and in parallel if they don't depend each other).
Then it serves you the result on a silver platter.

Importing diogenes
==================
The easiest way to import Diogenes is using commonjs:

    var Diogenes = require('diogenes');

You can also import it as a global module but it requires [occamsrazor](https://github.com/sithmel/occamsrazor.js).

Creating a registry
===================
You can create a registry with:

    var registry = Diogenes.getRegistry();

or if you prefer:

    var registry = new Diogenes();


Defining a service
==================
A service is defined by a name (a string), a list of dependencies (list of strings) and a function with a specific interface:

    registry.addService("myservice", ["service1", "service2"], function (config, deps, next) {
        // config contains the configuration of the services (common to all of them)
        // in deps.service1 and deps.service2 there will be the output of the service1 and service2 services

        // ...

        next(undefined, outputOfThisService);
    });

In case of error conditions, the service will output an Error instance as the first argument.

Calling a service
=================
You can call a service using the method getService with the name and the configuration.

    registry.getService("myservice", config, function (service){
        // service is the output of the service
    });

That is equivalent to calling service1 and service2 with config as parameter and then myservice.
Diogenes will take care of doing the correct order.

Chaining
========
addService and getService are chainable. So you can:

    registry.addService("service1", service1)
    .addService("service1", service2);
    .addService("myservice", ["service1", "service2"], myservice);

    registry.getService("service1", doSomethingWithService1)
    .getService("myservice", doSomethingWithMyService);

Plugins
=======
A registry can have more than one service with the same name (and a different set of dependencies).
The correct service will be chosen using the configuration and an [occamsrazor validator](https://github.com/sithmel/occamsrazor.js#tutorial).
Diogenes.validator is a copy of occamsrazor.validator (for convenience). Example:

    var isTest = Diogenes.validator().has('test');

    registry.addService("data", ["db", "url"], getDataFromDB);
    registry.addService("data", isTest, [], getMockData);

With this setup, depending on the esistence of the property "test" in the configuration, I will use one or the other service.
Be careful in designing the validators. A validator must exclude another OR be more specific than the others. If more than one validator matches with the same score, the system will throw an exception.

Errors
======
The library is currently able to detect and throws exceptions on few cases:

* circular dependencies
* the service returns or throws an exception
* missing dependencies (or incompatible plugin)
* more than one plugin matches

Use cases
=========
...
