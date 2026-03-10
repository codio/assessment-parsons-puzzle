window.codioAssessmentsHelper = window.codioAssessmentsHelper || {}

window.codioAssessmentsHelper.METHODS = {
  GET_STYLES: 'assessments.getStyles',
  GET_STYLES_RESPONSE: 'assessments.getStyles.response',
  GET_STATE: 'assessments.getState',
  GET_STATE_RESPONSE: 'assessments.getState.response',
  SET_STATE: 'assessments.setState',
  SET_HEIGHT: 'assessments.setHeight',
  GET_CONTENT: 'assessments.getContent',
  SET_CONTENT: 'assessments.setContent',
  CALLBACK: 'assessments.callback'
}

window.codioAssessmentsHelper.callbacks = {}

export const deferred = () => {
  let resolve, reject
  const promise = new Promise((resolveF, rejectF) => {
    resolve = resolveF
    reject = rejectF
  })
  return { resolve, reject, promise }
}

window.codioAssessmentsHelper.send = (methodName, data) => {
  const id = window.location.hash.substring(1)
  console.log('assessment iframe send', methodName, data)
  window.parent.postMessage(JSON.stringify({id, method: methodName, data}), '*')
}

window.codioAssessmentsHelper.sendAndWait = (methodName, data = {}) => {
  const id = `id_${Date.now()}`
  const dfd = deferred()
  window.codioAssessmentsHelper.callbacks[id] = (data) => data && data.error ? dfd.reject(new Error(data.error)) : dfd.resolve(data)
  data.callbackId = id
  window.codioAssessmentsHelper.send(methodName, data)
  return dfd.promise
}

window.codioAssessmentsHelper.processCallback = (data) => {
  if (!data) {
    return
  }
  const {callbackId, ...result} = data
  window.codioAssessmentsHelper.callbacks[callbackId] && window.codioAssessmentsHelper.callbacks[callbackId](result)
}

window.codioAssessmentsHelper.initialize = (callback) => {
  window.addEventListener(
    'message',
    (event) => {
      callback(event.data)
    },
    false
  )
  window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STATE)
  window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STYLES)
}

window.codioAssessmentsHelper.getBodyHeight = () => {
  const body = document.body
  const html = document.documentElement
  return Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight)
}

window.codioAssessmentsHelper.addBodyHeightListener = () => {
  const debounceSetHeight = window.codioAssessmentsHelper.debounce(() => {
    window.codioAssessmentsHelper.send(
      window.codioAssessmentsHelper.METHODS.SET_HEIGHT, {height: window.codioAssessmentsHelper.getBodyHeight()})
  }, 100)
  const resizeObserver = new ResizeObserver(debounceSetHeight)
  resizeObserver.observe(document.body)
}

window.codioAssessmentsHelper.addStyle = (() => {
  const style = document.createElement('style')
  document.head.append(style)
  return (styleString) => style.textContent = styleString
})()

window.codioAssessmentsHelper.debounce = (func, timeout) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

window.codioAssessmentsHelper.getButtonCaption = (assessmentOptions, maxAttemptsCount) => {
  const {usedAttempts, buttonCaption} = assessmentOptions
  let caption = buttonCaption
  if (maxAttemptsCount) {
    const attemptsLeftCount = usedAttempts < maxAttemptsCount ? maxAttemptsCount - usedAttempts : 0
    const attemptsLeft = attemptsLeftCount ? ` (${attemptsLeftCount} left)` : ''
    caption = `${caption}${attemptsLeft}`
  }
  return caption
}

window.codioAssessmentsHelper.calculateGuidance = (
  authoringMode,
  showAsTeacher,
  answered,
  {showGuidanceAfterResponseOption, guidance, points},
  {answerGuidance, answerPoints, attemptsCount, passed, isCompletedAndReleased}
) => {
  if (authoringMode) {
    let showGuidanceAfterResponse = false
    if (!showGuidanceAfterResponseOption) {
      showGuidanceAfterResponse = false
    } else if (showGuidanceAfterResponseOption.type === 'Always') {
      showGuidanceAfterResponse = true
    } else if (showGuidanceAfterResponseOption.type === 'Attempts') {
      showGuidanceAfterResponse = attemptsCount >= showGuidanceAfterResponseOption.passedFrom || passed
    } else if (showGuidanceAfterResponseOption.type === 'Score' && answered) {
      showGuidanceAfterResponse = points <= 0 ||
        (answerPoints * 100 / points) >= showGuidanceAfterResponseOption.passedFrom
    } else if (showGuidanceAfterResponseOption.type === 'WhenGradesReleased') {
      showGuidanceAfterResponse = true
    }
    return showAsTeacher || answered && showGuidanceAfterResponse ? guidance : ''
  }

  // for student, it is calculated on server side
  let showGuidance = answered
  if (showGuidanceAfterResponseOption?.type === 'WhenGradesReleased') {
    showGuidance = answered && isCompletedAndReleased
  }

  return showAsTeacher ? guidance : (showGuidance ? answerGuidance : '')
}
