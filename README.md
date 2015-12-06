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

It resolves all the dependency tree for you, executing the components in the right order (and in parallel if they don't dependen each other).
Then it serves you the result on a silver platter.

It is not all, more to come ...
