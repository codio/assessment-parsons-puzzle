(function (){
  const parsonsGraderTypes = {
    LINE_BASED: '1',
    VARIABLE_CHECK: '2',
    UNIT_TEST: '3',
    LANGUAGE_TRANSLATION: '4',
    TURTLE: '5'
  }

  const actionsToCatch = ['moveOutput', 'addOutput', 'removeOutput', 'moveInput', 'toggle']

  let assessmentOptions = null
  let assessment = null
  let parson = null
  let parsonsOptions = null
  let processing = false
  let feedback = null
  let currentData = null

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
    window.codioAssessmentsHelper.send(
      window.codioAssessmentsHelper.METHODS.SET_STATE,
      {
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
  }

  const getProcessedOptions = (options, grader) => {
    let opt = structuredClone(options)

    const sortableId = 'sortableId'
    const trashId = opt.trashId ? `trashId` : null

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
        opt.turtleModelCanvas = 'modelCanvasId'
        opt.turtleStudentCanvas = 'studentCanvasId'
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
    console.log('assessment iframe applyState', data)
    currentData = data
    if (!assessment) {
      applyStateInitial(data)
      return
    }
    if (data.state) {
      fillLinesFromProps(data)
      updateHtml()
      renderGuidance()
      return
    }
    // reset
    if (currentData.state && !data.state) {
      parson.shuffleLines()
      parson.clearFeedback()
      updateFeedback(null)
      updateHtml()
      renderGuidance()
    }
  }

  const onCheck = (event) => {
    event.preventDefault()
    const feedback = parson.grader.grade({skipHighlight: true}) // todo remove after check will be implemented
    updateProcessing(true)

    window.codioAssessmentsHelper.send(
      window.codioAssessmentsHelper.METHODS.SUBMIT_ANSWER,
      {
        result: {
          trashHash: parson.trashHash(),
          solutionHash: parson.solutionHash(),
          toggleStates: JSON.stringify(parson._getToggleStates() || {}),
          studentCode: parson.getStudentCode(),
          success: feedback.success // todo remove after check will be implemented
        }
    })
  }

  const onUnblock = (event) => {
    event.preventDefault()
    codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.UNBLOCK)
  }

  const onReset = (event) => {
    event.preventDefault()
    codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.RESET)
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
    $('.instructions-text').html(assessment.source.settings.instructions)
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
    renderGuidance()
  }

  const isAnswerCompatible = () => {
    if (!parson) {
      return true
    }
    const {isDisabled, useSubmitButtons} = assessmentOptions
    const {state, result} = currentData || {}
    const {canAnswerAgain} = getAssessmentState()

    const noButton = !isDisabled && !useSubmitButtons && canAnswerAgain

    const linesCount = parson.modified_lines.length
    const calculateLinesInHash = (hash) => hash === '-' ? 0 : hash.split('-').length
    if (result?.solutionHash && !noButton) {
      return (calculateLinesInHash(result.solutionHash) + calculateLinesInHash(result.trashHash)) === linesCount
    } else if (state?.solutionHash) {
      return (calculateLinesInHash(state.solutionHash) + calculateLinesInHash(state.trashHash)) === linesCount
    }
    return true
  }

  const renderFooter = () => {
    const footerContainer = $('.codio-assessment-footer')
    const caption = window.codioAssessmentsHelper.getButtonCaption(assessmentOptions, assessment.source.maxAttemptsCount)
    footerContainer.find('.check-button').html(caption)
  }

  const renderGuidance = () => {
    const guidanceBlock = $('.codio-assessment-guidance-block')
    guidanceBlock.empty()
    const assessmentState = getAssessmentState()
    const {result} = currentData || {}
    const guidance = window.codioAssessmentsHelper.calculateGuidance(
      !assessmentOptions.eduStartedAssignment,
      assessmentOptions.showAsTeacher,
      assessmentState.answered,
      assessment.source,
      result ?
        {
          answerGuidance: result.guidance,
          answerPoints: result.points,
          attemptsCount: result.usedAttempts,
          passed: result.state === window.codioAssessmentsHelper.States.PASS || feedback?.success === true,
          isCompletedAndReleased: window.codioAssessmentsHelper.calculateCompletedAndReleased(
            assessmentOptions.eduStartedAssignment
          )
        } : {}
    )
    if (guidance) {
      const guidanceContainer = $('<div class="codio-assessment-guidance-container" />')
      const guidanceText = $('<div class="codio-assessment-guidance-text">').html(guidance)
      guidanceContainer.append(guidanceText)
      guidanceBlock.append(guidanceContainer)
    }
  }

  const getAssessmentState = () => {
    const result = currentData ? currentData.result : null
    const answered = !!(result && result.state) && result.state !== window.codioAssessmentsHelper.States.RESET
    const usedAttempts = result && result.usedAttempts || 0
    const passed = result && result.state === window.codioAssessmentsHelper.States.PASS
    const canAnswerAgain = window.codioAssessmentsHelper.isCanAnswerAgain(assessment, result)
    const isDisabled = assessmentOptions.isDisabled || processing || answered && (!canAnswerAgain || passed)
    const showModify = assessmentOptions.showUnblock && (!answered || canAnswerAgain)
    const teacherInStudentsProject = assessmentOptions.showAsTeacher && !assessmentOptions.owner

    return {
      isDisabled,
      answered,
      usedAttempts,
      passed,
      canAnswerAgain,
      showModify,
      teacherInStudentsProject
    }
  }

  const updateHtml = () => {
    if (!assessment) {
      return
    }
    // processing, new state/results
    const assessmentState = getAssessmentState()
    const blockActionsEl = $('.block-actions')
    assessmentState.isDisabled ? blockActionsEl.removeClass('hide') : blockActionsEl.addClass('hide')
    updateFooterButtons()
  }

  const updateVisibility = (el, visible) => {
    visible ? el.removeClass('hide') : el.addClass('hide')
  }

  const updateFooterButtons = () => {
    const assessmentState = getAssessmentState()
    const {teacherInStudentsProject, showModify, isDisabled, canAnswerAgain, passed, answered} = assessmentState

    const checkVisibility = !showModify && assessmentOptions.useSubmitButtons
    const checkBtn = $('.check-button')
    updateVisibility(checkBtn, checkVisibility)
    $('.check-button').attr('disabled', isDisabled)

    const unblockVisibility = !teacherInStudentsProject && showModify
    updateVisibility($('.unblock-button'), unblockVisibility)

    const resetVisibility = !showModify && answered && assessmentOptions.owner
      && (!canAnswerAgain || passed || !isAnswerCompatible())
    updateVisibility($('.reset-button'), resetVisibility)
  }

  const bindEvents = () => {
    $('.block-actions').on('click', blockActions)
    $('.model-canvas').on('click', redrawTurtleModel)
    $('.check-button').on('click', onCheck)
    $('.unblock-button').on('click', onUnblock)
    $('.reset-button').on('click', onReset)

    window.codioAssessmentsHelper.addBodyHeightListener()
  }

  const render = () => {
    const container = $('.codio-assessment')
    const nameEl = container.find('.codio-assessment-name')
    assessment.source.showName ? nameEl.text(assessment.source.name) : nameEl.remove()
    renderContent()
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
        case window.codioAssessmentsHelper.METHODS.GET_STYLES_RESPONSE:
          window.codioAssessmentsHelper.addStyle(data.css)
          break
        case window.codioAssessmentsHelper.METHODS.GET_STATE_RESPONSE:
          updateProcessing(false)
          applyState(data)
          break
        case window.codioAssessmentsHelper.METHODS.CALLBACK: {
          window.codioAssessmentsHelper.processCallback(data)
          break
        }
      }
    } catch {}
  }

  window.addEventListener('load', () => {
    window.codioAssessmentsHelper.registerMessageListener(processMessage)
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STATE)
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STYLES)
  })
})()
