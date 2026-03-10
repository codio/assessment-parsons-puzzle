(function () {
  const flipObject = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]))
  const parsonGraderMap = {
    '1': 'ParsonsWidget._graders.LineBasedGrader',
    '2': 'ParsonsWidget._graders.VariableCheckGrader',
    '3': 'ParsonsWidget._graders.UnitTestGrader',
    '4': 'ParsonsWidget._graders.LanguageTranslationGrader',
    '5': 'ParsonsWidget._graders.TurtleGrader'
  }
  const METHODS = {
    GET_SETTINGS: 'assessments.getSettings',
    GET_SETTINGS_RESPONSE: 'assessments.getSettings.response',
    EXPORT_SETTINGS: 'assessments.exportSettings',
    EXPORT_SETTINGS_RESPONSE: 'assessments.exportSettings.response'
  }
  const origin = '*'

  const id = window.location.hash.substring(1)
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
    const parsons = collectParsons()
    return {settings: parsons}
  }

  const exportSettings = () => {
    const data = collectSettings();
    send(METHODS.EXPORT_SETTINGS_RESPONSE, {data});
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
  }

  const processMessage = (jsonData) => {
    console.log('iframe processMessage', jsonData)
    try {
      const {method, data} = JSON.parse(jsonData);
      switch (method) {
        case METHODS.EXPORT_SETTINGS:
          exportSettings();
          break;
        case METHODS.GET_SETTINGS_RESPONSE:
          applySettings(data.settings);
          break;
      }
    } catch {}
  }

  const send = (methodName, data) => {
    console.log('iframe send', methodName, data)
    window.parent.postMessage(JSON.stringify({id, method: methodName, data}), origin);
  }

  const onLoad = () => {
    window.addEventListener(
      'message',
      (event) => {
        processMessage(event.data)
      },
      false
    );
    send(METHODS.GET_SETTINGS)
  }

  window.addEventListener('load', onLoad);
})()
