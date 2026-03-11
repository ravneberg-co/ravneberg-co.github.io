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

    // Read and concatenate CSS files
    const cssFiles = ['variables.css', 'base.css', 'components.css'];
    let concatenatedCSS = '';
    cssFiles.forEach(file => {
        const content = fs.readFileSync(path.join('./src/styles', file), 'utf8');
        concatenatedCSS += content + '\n';
    });

    // Ensure docs directory exists
    if (!fs.existsSync('./docs')) {
        fs.mkdirSync('./docs');
    }

    // Process all pages in src/templates/pages/
    const pagesDir = './src/templates/pages';
    const pageFiles = fs.readdirSync(pagesDir);
    const builtPages = [];

    pageFiles.forEach(filename => {
        const matches = /^([^.]+).hbs$/.exec(filename);
        if (!matches) return;

        const pageName = matches[1];
        const pageTemplate = fs.readFileSync(path.join(pagesDir, filename), 'utf8');
        const pageCompiled = Handlebars.compile(pageTemplate);

        // Check for page-specific data file
        let pageData = { ...siteData };
        const pageDataPath = `./src/data/${pageName}.json`;
        if (fs.existsSync(pageDataPath)) {
            delete require.cache[require.resolve(pageDataPath)];
            const specificData = JSON.parse(fs.readFileSync(pageDataPath, 'utf8'));
            pageData = { ...siteData, ...specificData };
        }

        // Render page content
        const pageContent = pageCompiled(pageData);

        // Render full page with layout
        const fullPage = layout({
            title: pageData.pageTitle || pageData.title,
            description: pageData.pageDescription || pageData.description,
            body: pageContent,
            styles: concatenatedCSS
        });

        // Determine output path
        let outputPath;
        if (pageName === 'index') {
            outputPath = './docs/index.html';
        } else {
            // Create subdirectory for clean URLs
            const subDir = `./docs/${pageName}`;
            if (!fs.existsSync(subDir)) {
                fs.mkdirSync(subDir, { recursive: true });
            }
            outputPath = `${subDir}/index.html`;
        }

        fs.writeFileSync(outputPath, fullPage);
        builtPages.push(pageName === 'index' ? 'index.html' : `${pageName}/index.html`);
    });

    // Copy favicon
    fs.copyFileSync('./favicon.svg', './docs/favicon.svg');

    console.log(`✓ Built ${builtPages.length} page(s): ${builtPages.join(', ')}`);
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
