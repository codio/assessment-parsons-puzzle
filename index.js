(function (){
  const METHODS = {
    GET_STYLES: 'assessments.getStyles',
    GET_STATE: 'assessments.getState',
    SAVE_STATE: 'assessments.saveState'
  }

  const parsonsGraderTypes = {
    LINE_BASED: '1',
    VARIABLE_CHECK: '2',
    UNIT_TEST: '3',
    LANGUAGE_TRANSLATION: '4',
    TURTLE: '5'
  }

  const states = {
    FAIL: 'fail',
    PASS: 'pass',
    RESET: 'reset',
    PROGRESS: 'progress'
  }

  const actionsToCatch = ['moveOutput', 'addOutput', 'removeOutput', 'moveInput', 'toggle']

  const origin = '*'

  const id = window.location.hash.substring(1)

  let assessmentOptions = null
  let assessment = null
  let parson = null
  let parsonsOptions = null
  let processing = false
  let feedback = null
  let previousData = null

  const getToggleStatesFromString = (states) => {
    try {
      return JSON.parse(states)
    } catch {
      return {}
    }
  }

  const updateProcessing = (status) => {
    processing = status
    updateHtml()
  }

  const onAction = action => {
    if (!actionsToCatch.includes(action.type)) {
      return
    }
    updateProcessing(true)
    send(METHODS.SAVE_STATE, {
      state: {
        trashHash: parson.trashHash(),
        solutionHash: parson.solutionHash(),
        toggleStates: JSON.stringify(parson._getToggleStates() || {})
      }
    })
  }

  const updateFeedback = data => {
    feedback = data
    renderFeedback()
    renderGuidance()
  }

  const getProcessedOptions = (options, grader) => {
    let opt = structuredClone(options)

    const sortableId = `sortable-${id}`
    const trashId = opt.trashId ? `trash-${id}` : null

    opt.action_cb = onAction
    opt.feedback_cb = updateFeedback

    opt.sortableId = sortableId
    opt.trashId = trashId

    if (!grader) {
      return opt
    }
    switch (grader) {
      case parsonsGraderTypes.LINE_BASED:
        opt.grader = ParsonsWidget._graders.LineBasedGrader
        break
      case parsonsGraderTypes.VARIABLE_CHECK:
        opt.grader = ParsonsWidget._graders.VariableCheckGrader
        break
      case parsonsGraderTypes.UNIT_TEST:
        opt.grader = ParsonsWidget._graders.UnitTestGrader
        break
      case parsonsGraderTypes.LANGUAGE_TRANSLATION:
        opt.grader = ParsonsWidget._graders.LanguageTranslationGrader
        break
      case parsonsGraderTypes.TURTLE: {
        opt.turtleModelCanvas = `modelCanvas-${id}`
        opt.turtleStudentCanvas = `studentCanvas-${id}`
        opt.grader = ParsonsWidget._graders.TurtleGrader
        break
      }
      default:
        delete opt.grader
    }
    return opt
  }

  const getParsonsOptions = () => {
    let sourceOptions = {}
    try {
      sourceOptions = JSON.parse(assessment.source.settings.options)
    } catch (e) {}
    return getProcessedOptions(sourceOptions, assessment.source.settings.grader)
  }

  const redrawTurtleModel = () => {
    parson.grader._executeTurtleModel()
  }

  const fillLinesFromProps = ({state, result}, initial = false) => {
    if (result && result.solutionHash) {
      const showFeedback = parsonsOptions.show_feedback !== false
      const options = {showFeedback: showFeedback, skipHighlight: !showFeedback}
      const states = getToggleStatesFromString(result.toggleStates)
      parson.createHTMLFromHashes(result.solutionHash, result.trashHash || '-', states)
      parson.getFeedback(options)
    } else if (state && state.solutionHash) {
      const states = getToggleStatesFromString(state.toggleStates)
      parson.createHTMLFromHashes(state.solutionHash, state.trashHash || '-', states)
    } else {
      initial && parson.shuffleLines()
    }
  }

  const applyStateInitial = (data) => {
    const {state, result, ...dataWithoutState} = data
    assessment = dataWithoutState.assessment
    assessmentOptions = dataWithoutState.options

    parsonsOptions = getParsonsOptions()

    render()

    parson = new ParsonsWidget(parsonsOptions)
    parson.init(assessment.source.settings.initial)

    fillLinesFromProps(data, true)
    // redraw model after DOM will be rendered()
    if (assessment.source.settings.grader === parsonsGraderTypes.TURTLE) {
      // can not be drawn in same time
      setTimeout(() => redrawTurtleModel(), 500)
    }
    updateHtml()
  }

  const applyState = (data) => {
    previousData = data
    if (!assessment) {
      applyStateInitial(data)
      return
    }
    if (data.state) {
      fillLinesFromProps(data)
      updateHtml()
      return
    }
    // reset
    if (previousData.state && !data.state) {
      parson.shuffleLines()
      parson.clearFeedback()
      updateFeedback(null)
    }
  }

  const onCheck = (event) => {
    event.preventDefault()
    const feedback = parson.grader.grade({skipHighlight: true})
    updateProcessing(true)

    send(METHODS.SAVE_STATE, {
      result: {
        trashHash: parson.trashHash(),
        solutionHash: parson.solutionHash(),
        toggleStates: JSON.stringify(parson._getToggleStates() || {}),
        studentCode: parson.getStudentCode(),
        success: feedback.success
      }
    })
  }

  const blockActions = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const processFeedbackHtmlError = (feedbackHtml) => {
    if (assessment.source.settings.grader !== parsonsGraderTypes.TURTLE) {
      return feedbackHtml
    }
    const commandsMap = {
      'fwd': 'forward',
      'bwd': 'backward',
      'lt': 'left',
      'rt': 'right',
      'gt': 'goto',
      'setpos': 'setposition',
      'pcolor': 'pencolor',
      'fcolor': 'fillcolor'
    }
    const commandPattern = new RegExp(Object.keys(commandsMap).join('|'), 'gi')
    const commandBlockPattern = /<span class='(expected|actual)'>(.*?)<\/span>/g

    return feedbackHtml.replace('<span class=\'msg\'></span>',
      '<span class=\'msg\'>Your solution does not match that of the model image</span>')
      .replace(commandBlockPattern, commands => {
        return commands.replace(/:/g, ';')
          .replace(commandPattern, command => {
            const feedbackCommand = ' ' + commandsMap[command] || ''
            return feedbackCommand.toUpperCase()
          })
      })
  }

  const renderFeedback = () => {
    const feedbackContainer = $('.feedback-container')
    feedbackContainer.empty()

    if (!feedback || feedback.success) {
      return
    }
    let feedbackEl
    if (feedback.html) {
      feedbackEl = $('<div>').html(processFeedbackHtmlError(feedback.html))
    } else {
      feedbackEl = $(`<div class='testcase fail'>`)
        .append($(`<span class='errormsg'>`).text(feedback.errors.join('\n')))
    }
    feedbackContainer.append(feedbackEl)
  }

  const renderContent = () => {
    $('.instructions-text').html(assessment.source.instructions)
    const sortableContainer = $('.sortable-container')
    sortableContainer.attr('id', parsonsOptions.sortableId)
    const trashContainer = $('.trash-container')
    if (parsonsOptions.trashId) {
      trashContainer.attr('id', parsonsOptions.trashId)
    } else {
      trashContainer.remove()
    }
    if (assessment.source.settings.grader === parsonsGraderTypes.TURTLE) {
      $('.model-canvas').attr('id', parsonsOptions.turtleModelCanvas)
      $('.student-canvas').attr('id', parsonsOptions.turtleStudentCanvas)
    } else {
      $('.turtle-drawing').remove()
    }
  }

  const renderGuidance = () => {
    const guidanceContainer = $('.codio-assessment-guidance')
    guidanceContainer.empty()
    const result = previousData ? previousData.result : null
    const answered = !!(result && result.state) && result.state !== states.RESET
    const guidance = window.codioAssessmentHelper.calculateGuidance(
      !assessmentOptions.eduStartedAssignment,
      assessmentOptions.showAsTeacher,
      answered,
      assessment.source.settings,
      result ?
        {
          answerGuidance: result.guidance,
          answerPoints: result.points,
          attemptsCount: result.usedAttempts,
          passed: result.state === states.PASS || feedback && feedback.success === true
        } : {}
    )
    if (!guidance) {
      return
    }
    const guidanceEl = $(`<div class='codio-assessment-guidance-container'></div>`)
    guidanceEl.append($(`<div class='codio-assessment-guidance-text'></div>`).html(guidance))
    guidanceContainer.append(guidanceEl)
  }

  const renderFooter = () => {
    const result = previousData ? previousData.result : null
    const footerContainer = $('.codio-assessment-footer')
    const caption = codioAssessmentHelper.getButtonCaption(assessmentOptions, assessment.source, result)
    footerContainer.append(`<button class='check-button codio-assessment-button'>${caption}</button>`)
  }

  const updateHtml = () => {
    if (!assessment) {
      return
    }
    // processing, new state/results
    const result = previousData ? previousData.result : null
    const answered = !!(result && result.state) && result.state !== states.RESET
    const usedAttempts = result && result.usedAttempts || 0
    const passed = result && result.state === states.PASS
    const canAnswerAgain = !assessment.source.settings.maxAttemptsCount ||
      usedAttempts < assessment.source.settings.maxAttemptsCount
    const isDisabled = assessmentOptions.isDisabled || processing || answered && (!canAnswerAgain || passed)
    $('.check-button').attr('disabled', isDisabled)
    const blockActionsEl = $('.block-actions')
    isDisabled ? blockActionsEl.removeClass('hide') : blockActionsEl.addClass('hide')
  }

  const bindEvents = () => {
    $('.block-actions').on('click', blockActions)
    $('.model-canvas').on('click', () => redrawTurtleModel())
    $('.check-button').on('click', onCheck)
  }

  const render = () => {
    // todo showUnblock, showModify
    const container = $('.codio-assessment')
    const nameEl = container.find('.codio-assessment-name')
    assessment.source.showName ? nameEl.text(assessment.source.name) : nameEl.remove()
    renderContent()
    renderGuidance()
    renderFooter()
    updateHtml()
    bindEvents()
    container.removeClass('hide')
  }

  const processMessage = (jsonData) => {
    try {
      const {method, data} = JSON.parse(jsonData)
      console.log('assessment iframe processMessage', jsonData, method, data)
      switch (method) {
        case METHODS.GET_STYLES:
          codioAssessmentHelper.addStyle(data.css)
          break
        case METHODS.GET_STATE:
          updateProcessing(false)
          applyState(data)
          break
        case METHODS.SAVE_STATE:
          updateProcessing(false)
          break
      }
    } catch {}
  }

  const send = (methodName, data) => {
    console.log('assessment iframe send', methodName, data)
    window.parent.postMessage(JSON.stringify({id, method: methodName, data}), origin)
  }

  const onLoad = () => {
    window.addEventListener(
      'message',
      (event) => {
        processMessage(event.data)
      },
      false
    )
    send(METHODS.GET_STATE)
    send(METHODS.GET_STYLES)
  }

  window.addEventListener('load', onLoad)
})()
