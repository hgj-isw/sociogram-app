/* Standaardvragen — bibliotheek (teksten). Tonen in beeld = enabled. */
window.SociogramQuestions = (function () {
  var DEFAULT_QUESTIONS = [
    {
      id: "q-samenwerken",
      polarity: "positive",
      enabled: false,
      inPackage: true,
      maxChoices: 3,
      label: "Samenwerken",
      text: "Met wie werk je graag samen?",
      hint: "Kies tot 3 klasgenoten.",
    },
    {
      id: "q-zitten",
      polarity: "positive",
      enabled: false,
      inPackage: true,
      maxChoices: 3,
      label: "Zitten",
      text: "Naast wie wil je graag zitten?",
      hint: "Kies tot 3 klasgenoten.",
    },
    {
      id: "q-pauze",
      polarity: "positive",
      enabled: false,
      inPackage: true,
      maxChoices: 3,
      label: "Pauze",
      text: "Met wie praat je graag in de pauze?",
      hint: "Kies tot 3 klasgenoten.",
    },
    {
      id: "q-veilig",
      polarity: "positive",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Steun",
      text: "Bij wie kun je terecht als je ergens mee zit?",
      hint: "Kies tot 2 klasgenoten.",
    },
    {
      id: "q-leider",
      polarity: "positive",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Leiderschap",
      text: "Wie zou je kiezen als groepsleider voor een project?",
      hint: "Kies tot 2 klasgenoten.",
    },
    {
      id: "q-buiten-school",
      polarity: "positive",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Buiten school",
      text: "Met wie zou je graag willen afspreken buiten school?",
      hint: "Kies tot 2 klasgenoten.",
    },
    {
      id: "q-niet-samenwerken",
      polarity: "negative",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Minder graag samenwerken",
      text: "Met wie werk je het minst graag samen?",
      hint: "Optioneel · kies tot 2. Gebruik bewust.",
    },
    {
      id: "q-niet-zitten",
      polarity: "negative",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Liever niet zitten",
      text: "Naast wie wil je liever niet zitten?",
      hint: "Optioneel · kies tot 2. Gebruik bewust.",
    },
    {
      id: "q-spanning",
      polarity: "negative",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Spanning",
      text: "Met wie ervaar je weleens spanning of ruzie?",
      hint: "Optioneel · kies tot 2. Alleen bij gerichte zorgvraag.",
    },
    {
      id: "q-uitsluiting",
      polarity: "negative",
      enabled: false,
      inPackage: false,
      maxChoices: 2,
      label: "Uitsluiting",
      text: "Wie laat anderen naar jouw idee vaak buiten de groep?",
      hint: "Optioneel · kies tot 2. Interpretatie met zorg.",
    },
  ];

  function cloneDefaultQuestions() {
    return DEFAULT_QUESTIONS.map(function (q) {
      return Object.assign({}, q);
    });
  }

  function migrateQuestion(q) {
    var copy = Object.assign({}, q);
    if (typeof copy.inPackage !== "boolean") {
      copy.inPackage =
        copy.polarity === "positive" &&
        (copy.id === "q-samenwerken" ||
          copy.id === "q-zitten" ||
          copy.id === "q-pauze" ||
          !!copy.enabled);
    }
    if (typeof copy.enabled !== "boolean") copy.enabled = false;
    return copy;
  }

  function activeQuestions(questions) {
    return questions.filter(function (q) {
      return q.enabled;
    });
  }

  function packageQuestions(questions, mode) {
    if (mode === "all") return questions.slice();
    if (mode === "positive") {
      return questions.filter(function (q) {
        return q.polarity === "positive";
      });
    }
    return questions.filter(function (q) {
      return q.inPackage;
    });
  }

  return {
    DEFAULT_QUESTIONS: DEFAULT_QUESTIONS,
    cloneDefaultQuestions: cloneDefaultQuestions,
    migrateQuestion: migrateQuestion,
    activeQuestions: activeQuestions,
    packageQuestions: packageQuestions,
  };
})();
