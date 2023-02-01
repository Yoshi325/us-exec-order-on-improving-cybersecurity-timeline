const fs = require('fs');
const yaml = require('js-yaml');
const crypto = require('crypto');
const moment = require('moment');

function defaultEntryCreator(fileName) {
  let entryContent = fs.readFileSync(`${__dirname}/entries/${fileName}`);
  let entryObject = {};
  if ('' != entryContent) {
    entryObject = yaml.load(entryContent);
  }
  if (!Object.prototype.hasOwnProperty.call(entryObject, 'id')) {
    entryObject = {...entryObject, id: crypto.randomUUID().toString()};
  }
  if (!Object.prototype.hasOwnProperty.call(entryObject, 'date')) {
    let entryDate = fileName.split(' ')[0];
    entryObject = {...entryObject, date: entryDate};
  }
  return entryObject;
}

function lookupPath(obj, path) {
  let current = obj;
  path.split('.').forEach(function(p){ current = current[p]; });
  return current;
}

function getReplacementValue(content, targetExpr) {
  const targetPath =
    (targetExpr.includes('||'))
    ? targetExpr.split('||')[0]
    : targetExpr
  ;
  const value = lookupPath(content, targetPath);
  if (value) {
    const valueCopy = JSON.parse(JSON.stringify(value));
    return valueCopy;

  } else if (targetExpr.includes('||')) {
    const defaultValue = JSON.parse(targetExpr.split('||')[1]);
    return defaultValue;

  } else {
    return undefined;

  }
}

function applyTemplate(template, content) {
  for (var i in template) {
    if (template[i] && "object" == typeof template[i]) {
      /* descend into child object */
      applyTemplate(template[i], content);
      continue
    }

    const matches = template[i].matchAll(/\${([^}]+)}/g);
    let match = matches.next();
    if ((match.done === true) && (match.value === undefined)) {
      /* no matches, carry on */
      continue
    }

    if (match.value[0] == template[i]) {
      /* single exact match (replace the whole value) */
      const value = getReplacementValue(content, match.value[1]);
      if (value !== undefined) {
        template[i] = value;
      }
      continue
    }

    while (match.done == false) {
      /* multiple matches, handle like a templated string */
      const value = getReplacementValue(content, match.value[1]);
      if (value) {
        template[i] = template[i].replace(match.value[0], value);
      }
      match = matches.next();
    }

  }
  return template;
}

function eoRelativeDeadlineEntryCreator(fileName) {
  let contentString = fs.readFileSync(`${__dirname}/entries/${fileName}`);
  if ('' == contentString) {
    return [];
  } else {
    const contentObject = yaml.load(contentString);
    return [...contentObject.deadlines.map(
      item => {
        const template = JSON.parse(contentObject.template);
        let entryObject = applyTemplate(template, item);
        const dayMatch = /([0-9]+) days of the date of this order/.exec(item.quote);
        if (dayMatch) {
          entryObject['date'] = moment.utc("2021-05-12", "YYYYMMDD").add(Number.parseInt(dayMatch[1]), "days").format("YYYY-MM-DD");
          entryObject.categories = [`EO+${dayMatch[1]}d`, ...entryObject.categories];
        }
        const yearMatch = /([0-9]+) years? of the date of this order/.exec(item.quote);
        if (yearMatch) {
          entryObject['date'] = moment.utc("2021-05-12", "YYYYMMDD").add(Number.parseInt(yearMatch[1]), "years").format("YYYY-MM-DD");
          entryObject.categories = [`EO+${yearMatch[1]}y`, ...entryObject.categories];
        }
        entryObject.categories = ['Deadline', ...entryObject.categories];
        return entryObject;
      }
    )]
  }
}

const header = 'Timeline for the United States Executive Order on Improving the Nation’s Cybersecurity';
const footer = 'A timeline of events related to EO 14028.';
const entryFileProcessors = {
  "eo-relative-deadlines.yaml": eoRelativeDeadlineEntryCreator,
  "other-relative-deadlines.yaml": fileName => { return {}; }, // ToDo: create parser for other relative deadlines
};
const todayEntry = {date: moment.utc().format("YYYY-MM-DD"), title: "We are here.", body: "Current Date. <br/> (or atleast the date this was last updated)", categories: []};
const entries = [
  todayEntry, ... fs.readdirSync(`${__dirname}/entries/`).map(
    /* lookup the hander, or use default */
    fileName => (entryFileProcessors[fileName] || defaultEntryCreator)(fileName)
  ).flat(
    1
  ).filter(
    /* discard entries without titles (also workaround for empty files) */
    entryObject => Object.prototype.hasOwnProperty.call(entryObject, 'title')
  )
].sort(
  (a, b) => {
    const a_date = a.date.split('T')[0].split('-').join('');
    const b_date = b.date.split('T')[0].split('-').join('');
    const result = a_date > b_date ? 1 : a_date < b_date ? -1 : 0;
    return result;
  }
);

// Page details
const pageTitle = 'EO 14028 Timeline'; // The title of the page that shows in the browser tab
const pageDescription = 'Timeline for the United States Executive Order on Improving the Nation’s Cybersecurity (EO 14028).'; // The description of the page for search engines
const pageAuthor = 'Charles L. Yost'; // Your name

// DON'T EDIT BELOW THIS LINE! --------------------------------------------------------------------
const getFilters = (entries) => {
  const filters = new Set();
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (Object.prototype.hasOwnProperty.call(entry, 'categories')) {
      for (var j = 0; j < entry.categories.length; j++) {
        filters.add(entry.categories[j]);
      }
    }
  }
  var filtersArray = [...filters];
  filtersArray.sort();
  return filtersArray;
};

const addCategoriesStringsToEntries = (entries) => {
  for (const entry of entries) {
    if (Object.prototype.hasOwnProperty.call(entry, 'categories')) {
      entry.categoriesString = entry.categories.join(',');
    }
  }
  return entries;
};

module.exports = {
  header,
  footer,
  entries: addCategoriesStringsToEntries(entries),
  filters: getFilters(entries),
  head: {
    title: pageTitle,
    description: pageDescription,
    author: pageAuthor,
  },
};
