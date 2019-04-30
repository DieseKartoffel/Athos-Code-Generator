# Athos-Code-Generator
A Web page that allows users to create Graph descriptions for the Athos Domain Specific Programming Language dynamically. 

The Athos DSL allows to easily solve Vehicle Routing- and similar problems but relies on users to define the graph structure by writing detailed code manually. This tool allows the navigation on a world map and interacting with it allows to freely choose and automatically connect locations with each other. The resulting graph is represented in a matrix table and can be turned into an Athos syntax graph description with the click of the button. The code can then be used as a template for future work.

## Getting Started

Visit http://athos.napier.ac.uk/generator to play with this tool.

### Run Locally

To run the Code Generator tool locally, simply download the project files and open the index.html with your favorite web browser.

### Hosting this project yourself

To host this project yourself, copy the project files on your webserver and install your favorite HTTP server tool. The following will describe the setup process for the XAMPP solution by Apache which can be found here: https://www.apachefriends.org/

- Install the Apache software on your server. Configuration guides can be found here: http://httpd.apache.org/docs/

- Find your htdocs folder (usually placed in the installation directory of xampp)

- Place the project files in that folder, make sure the html is called index.html if you are using the standard xampp configuration

- If you're hosting other services already, set up a new Virtual Host for a new domain/port or place it in a subfolder of an existing one

- Reload Apache config and visit your server address

## Built With

* [Leaflet](https://leafletjs.com/) - The Map Framework used
* [Open Streep Map](https://www.openstreetmap.org/) - Map Data 
* [Open Source Routing Machine](http://project-osrm.org/) - Used to generate Routes between nodes

- The external open source services can be hosted on your private server as well!

## Authors

* **Felix Vorlander** - *Initial work*

## Acknowledgments

* This project was done as a dissertation project at the Edinburgh Napier University
* Supervisor: Dr. Neil Urquhart
* Read more about the Athos DSL here: https://www.napier.ac.uk/~/media/worktribe/output-1148980/a-domain-specific-language-for-routing-problems.pdf
* Find more Athos related projects here: http://athos.napier.ac.uk
