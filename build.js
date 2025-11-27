const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

function build() {
    // Clear require cache to reload modules
    delete require.cache[require.resolve('./src/data/site.json')];

    // Read site data
    const siteData = JSON.parse(fs.readFileSync('./src/data/site.json', 'utf8'));

    // Clear partials
    Object.keys(Handlebars.partials).forEach(key => {
        delete Handlebars.partials[key];
    });

    // Register partials
    const partialsDir = './src/templates/partials';
    const partialFiles = fs.readdirSync(partialsDir);
    partialFiles.forEach(filename => {
        const matches = /^([^.]+).hbs$/.exec(filename);
        if (!matches) return;
        const name = matches[1];
        const template = fs.readFileSync(path.join(partialsDir, filename), 'utf8');
        Handlebars.registerPartial(name, template);
    });

    // Read layout
    const layoutTemplate = fs.readFileSync('./src/templates/layouts/main.hbs', 'utf8');
    const layout = Handlebars.compile(layoutTemplate);

    // Read and compile index page
    const indexTemplate = fs.readFileSync('./src/templates/pages/index.hbs', 'utf8');
    const indexCompiled = Handlebars.compile(indexTemplate);

    // Render index page with data
    const indexContent = indexCompiled(siteData);

    // Read and concatenate CSS files
    const cssFiles = ['variables.css', 'base.css', 'components.css'];
    let concatenatedCSS = '';
    cssFiles.forEach(file => {
        const content = fs.readFileSync(path.join('./src/styles', file), 'utf8');
        concatenatedCSS += content + '\n';
    });

    // Render full page with layout
    const fullPage = layout({
        title: siteData.title,
        description: siteData.description,
        body: indexContent,
        styles: concatenatedCSS
    });

    // Ensure docs directory exists
    if (!fs.existsSync('./docs')) {
        fs.mkdirSync('./docs');
    }

    // Write output
    fs.writeFileSync('./docs/index.html', fullPage);

    // Copy favicon
    fs.copyFileSync('./favicon.svg', './docs/favicon.svg');

    console.log('✓ Built index.html with inline CSS');
}

// Initial build
build();

// Watch mode
if (process.argv.includes('--watch')) {
    console.log('👀 Watching for changes...');

    let debounceTimer;
    const debouncedBuild = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try {
                build();
            } catch (error) {
                console.error('Build error:', error.message);
            }
        }, 100);
    };

    fs.watch('./src', { recursive: true }, (eventType, filename) => {
        if (filename) {
            console.log(`Changed: ${filename}`);
            debouncedBuild();
        }
    });
}
