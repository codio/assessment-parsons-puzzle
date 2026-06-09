(function () {
  let instructionsEditor = null
  const flipObject = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]))
  const parsonGraderMap = {
    '1': 'ParsonsWidget._graders.LineBasedGrader',
    '2': 'ParsonsWidget._graders.VariableCheckGrader',
    '3': 'ParsonsWidget._graders.UnitTestGrader',
    '4': 'ParsonsWidget._graders.LanguageTranslationGrader',
    '5': 'ParsonsWidget._graders.TurtleGrader'
  }
  let parsonsUI = null

  const collectParsons = () => {
    const exported = parsonsUI.export()
    const {grader, ...optionsWithoutGrader} = exported.options
    return {
      initial: exported.initial,
      options: JSON.stringify(optionsWithoutGrader),
      grader: flipObject(parsonGraderMap)[exported.options.grader]
    }
  }

  const collectSettings = () => {
    const errors = []

    const parsons = collectParsons()
    const instructions = instructionsEditor.getContent()

    !instructions && errors.push('Instructions field must be completed');

    return {data: {...parsons, instructions}, errors}
  }

  const exportSettings = () => {
    const data = collectSettings();
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.EXPORT_SETTINGS_RESPONSE, data);
  }

  const getParsonsSettingsFromAssessmentSettings = (settings) => {
    let options = {}
    try {
      options = JSON.parse(settings.options)
    } catch (e) {}

    if (settings.grader) {
      options.grader = parsonGraderMap[settings.grader]
    }

    return {
      initial: settings.initial || '',
      options: options
    }
  }

  const applySettings = (settings = {}) => {
    if (!settings.grader) {
      delete settings.grader
    }
    const parsonsData = getParsonsSettingsFromAssessmentSettings(settings)
    parsonsUI = ParsonsUI.build('#container', parsonsData);
    instructionsEditor.setContent(settings.instructions || '')
  }

  const processMessage = (jsonData) => {
    console.log('iframe processMessage', jsonData)
    try {
      const {method, data} = JSON.parse(jsonData);
      switch (method) {
        case window.codioAssessmentsHelper.METHODS.EXPORT_SETTINGS:
          exportSettings();
          break;
        case window.codioAssessmentsHelper.METHODS.GET_SETTINGS_RESPONSE:
          applySettings(data.settings);
          break;
      }
    } catch {}
  }

  const onLoad = () => {
    window.codioAssessmentsHelper.registerMessageListener(processMessage)
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_SETTINGS)
    instructionsEditor = window.codioAssessmentsHelper.initializeMarkdownEditor('instructions', 'instructions-command-bar')
  }

  window.addEventListener('load', onLoad);
})()
