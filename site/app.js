(function () {
  "use strict";

  var DATA = (window.SHUT_DATA || []).slice();

  // ---------- helpers ----------
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(escapedText, query) {
    if (!query) return escapedText;
    var re = new RegExp("(" + escapeRegex(query) + ")", "gi");
    return escapedText.replace(re, "<mark>$1</mark>");
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function slugify(str) {
    return "s-" + String(str)
      .replace(/[^֐-׿a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // ---------- build ordered structure ----------
  var sectionsMap = {}; // section -> { order, title, categories: { cat -> order } }
  DATA.forEach(function (item) {
    if (!sectionsMap[item.section]) {
      sectionsMap[item.section] = {
        order: item.section_order,
        title: item.section_title,
        categories: {}
      };
    }
    if (!(item.category in sectionsMap[item.section].categories)) {
      sectionsMap[item.section].categories[item.category] = item.category_order;
    }
  });

  var sectionList = Object.keys(sectionsMap).sort(function (a, b) {
    return sectionsMap[a].order - sectionsMap[b].order;
  });

  var answererSet = {};
  DATA.forEach(function (item) { answererSet[item.answerer] = true; });
  var answererList = Object.keys(answererSet).sort(function (a, b) { return a.localeCompare(b, "he"); });

  // ---------- populate filter selects ----------
  var sectionFilter = document.getElementById("section-filter");
  var categoryFilter = document.getElementById("category-filter");
  var answererFilter = document.getElementById("answerer-filter");
  var searchInput = document.getElementById("search-input");
  var confirmedFilter = document.getElementById("confirmed-filter");
  var clearBtn = document.getElementById("clear-filters");
  var resultsCount = document.getElementById("results-count");
  var contentEl = document.getElementById("content");
  var tocList = document.getElementById("toc-list");

  sectionList.forEach(function (sec) {
    var opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec;
    sectionFilter.appendChild(opt);
  });

  answererList.forEach(function (a) {
    var opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    answererFilter.appendChild(opt);
  });

  function refreshCategoryOptions() {
    var chosenSection = sectionFilter.value;
    categoryFilter.innerHTML = '<option value="">כל הקטגוריות</option>';
    if (!chosenSection) return;
    var cats = Object.keys(sectionsMap[chosenSection].categories).sort(function (a, b) {
      return sectionsMap[chosenSection].categories[a] - sectionsMap[chosenSection].categories[b];
    });
    cats.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  }

  // ---------- TOC ----------
  function buildTOC() {
    tocList.innerHTML = "";
    sectionList.forEach(function (sec) {
      var secEl = document.createElement("div");
      secEl.className = "toc-section";
      secEl.textContent = sec;
      secEl.addEventListener("click", function () {
        var target = document.getElementById(slugify(sec));
        if (target) target.scrollIntoView({ behavior: "smooth" });
      });
      tocList.appendChild(secEl);

      var cats = Object.keys(sectionsMap[sec].categories).sort(function (a, b) {
        return sectionsMap[sec].categories[a] - sectionsMap[sec].categories[b];
      });
      cats.forEach(function (cat) {
        var catEl = document.createElement("span");
        catEl.className = "toc-category";
        catEl.textContent = cat;
        catEl.addEventListener("click", function () {
          var target = document.getElementById(slugify(sec + "-" + cat));
          if (target) target.scrollIntoView({ behavior: "smooth" });
        });
        tocList.appendChild(catEl);
      });
    });
  }

  // ---------- filtering ----------
  function matchesFilters(item, query, sectionVal, categoryVal, answererVal, confirmedOnly) {
    if (sectionVal && item.section !== sectionVal) return false;
    if (categoryVal && item.category !== categoryVal) return false;
    if (answererVal && item.answerer !== answererVal) return false;
    if (confirmedOnly && !item.confirmed_by_rav) return false;
    if (query) {
      var haystack = (item.short_topic + " " + item.question + " " + item.answer + " " +
        item.asker + " " + item.answerer).toLowerCase();
      if (haystack.indexOf(query.toLowerCase()) === -1) return false;
    }
    return true;
  }

  // ---------- rendering ----------
  function renderCard(item, query) {
    var card = document.createElement("div");
    card.className = "card";

    var head = document.createElement("div");
    head.className = "card-head";

    var textWrap = document.createElement("div");
    var topicEl = document.createElement("div");
    topicEl.className = "card-topic";
    topicEl.innerHTML = highlight(escapeHtml(item.short_topic), query);
    textWrap.appendChild(topicEl);

    var metaEl = document.createElement("div");
    metaEl.className = "card-meta";
    var badges = [
      '<span class="badge">' + escapeHtml(item.date_display) + '</span>',
      '<span class="badge">שואל: ' + escapeHtml(item.asker) + '</span>',
      '<span class="badge">משיב: ' + escapeHtml(item.answerer) + '</span>'
    ];
    if (item.confirmed_by_rav) {
      badges.push('<span class="badge confirmed">✓ מאושר ע"י הרב</span>');
    }
    metaEl.innerHTML = badges.join("");
    textWrap.appendChild(metaEl);

    var chevron = document.createElement("div");
    chevron.className = "chevron";
    chevron.textContent = "▾";

    head.appendChild(textWrap);
    head.appendChild(chevron);

    var body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML =
      '<div class="qa-label">שאלה:</div>' +
      '<p class="qa-text">' + highlight(escapeHtml(item.question), query) + '</p>' +
      '<div class="qa-label">תשובה:</div>' +
      '<p class="qa-text">' + highlight(escapeHtml(item.answer), query) + '</p>';

    head.addEventListener("click", function () {
      card.classList.toggle("open");
    });

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function render() {
    var query = searchInput.value.trim();
    var sectionVal = sectionFilter.value;
    var categoryVal = categoryFilter.value;
    var answererVal = answererFilter.value;
    var confirmedOnly = confirmedFilter.checked;

    var filtered = DATA.filter(function (item) {
      return matchesFilters(item, query, sectionVal, categoryVal, answererVal, confirmedOnly);
    });

    contentEl.innerHTML = "";
    resultsCount.textContent = filtered.length + " תוצאות מתוך " + DATA.length;

    if (filtered.length === 0) {
      var empty = document.createElement("div");
      empty.className = "no-results";
      empty.textContent = "לא נמצאו תוצאות התואמות לחיפוש.";
      contentEl.appendChild(empty);
      return;
    }

    var bySection = {};
    filtered.forEach(function (item) {
      if (!bySection[item.section]) bySection[item.section] = {};
      if (!bySection[item.section][item.category]) bySection[item.section][item.category] = [];
      bySection[item.section][item.category].push(item);
    });

    sectionList.forEach(function (sec) {
      if (!bySection[sec]) return;
      var secBlock = document.createElement("div");
      secBlock.className = "section-block";

      var secHeader = document.createElement("div");
      secHeader.className = "section-header";
      secHeader.id = slugify(sec);
      secHeader.textContent = sec;
      secBlock.appendChild(secHeader);

      var cats = Object.keys(sectionsMap[sec].categories).sort(function (a, b) {
        return sectionsMap[sec].categories[a] - sectionsMap[sec].categories[b];
      });

      cats.forEach(function (cat) {
        if (!bySection[sec][cat]) return;
        var catBlock = document.createElement("div");
        catBlock.className = "category-block";

        var catHeader = document.createElement("div");
        catHeader.className = "category-header";
        catHeader.id = slugify(sec + "-" + cat);
        catHeader.textContent = cat;
        catBlock.appendChild(catHeader);

        bySection[sec][cat].forEach(function (item) {
          catBlock.appendChild(renderCard(item, query));
        });

        secBlock.appendChild(catBlock);
      });

      contentEl.appendChild(secBlock);
    });
  }

  // ---------- events ----------
  sectionFilter.addEventListener("change", function () {
    refreshCategoryOptions();
    render();
  });
  categoryFilter.addEventListener("change", render);
  answererFilter.addEventListener("change", render);
  confirmedFilter.addEventListener("change", render);
  searchInput.addEventListener("input", debounce(render, 200));

  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    sectionFilter.value = "";
    refreshCategoryOptions();
    answererFilter.value = "";
    confirmedFilter.checked = false;
    render();
  });

  var aboutToggle = document.getElementById("about-toggle");
  var aboutSection = document.getElementById("about");
  aboutToggle.addEventListener("click", function () {
    var isOpen = aboutSection.classList.toggle("open");
    aboutToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  var backToTop = document.getElementById("back-to-top");
  window.addEventListener("scroll", function () {
    backToTop.classList.toggle("visible", window.scrollY > 400);
  });
  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- init ----------
  buildTOC();
  render();
})();
