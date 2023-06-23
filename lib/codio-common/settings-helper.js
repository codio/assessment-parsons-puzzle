window.codioAssessmentSettingsHelper = function () {
  return {
    fixAssessment: (assessment) => {
      if (!assessment.source) {
        assessment.source = {}
      }

      if (assessment.source.oneTimeTest) {
        assessment.source.maxAttemptsCount = 1
      }
    },
    renderPoints: (container, assessment) => {
      const {source} = assessment
      const points = isNaN(source.points) ? 20 : source.points
      const pointsContainer = $('<div class="points-container codio-fieldset" />')
      pointsContainer.append('<label for="points">Points</label>')
      const input = $(`<input id='points' type='number' min='0' value='${points}' />`)
      pointsContainer.append(input)
      container.append(pointsContainer)
    },
    collectPoints: (container) => {
      const checkPoints = (points, pointsStr, isNegative) => {
        if (!/^[-+]?\d+$/.test(pointsStr)) {
          return isNegative ?
            'Incorrect points should be an integer' :
            'Correct points should be an integer'
        }
        if (points < 0 || points > 1000) {
          return isNegative ?
            'Incorrect points should be greater or equal to 0 and less than 1000' :
            'Correct points should be greater to 0 and less than 1000'
        }
      }
      const pointsStr = container.find('.points-container #points').val()
      const points = parseInt(pointsStr, 10)
      return {points, error: checkPoints(points, pointsStr)}
    },
    renderAttempts: (container, assessment) => {
      const {maxAttemptsCount} = assessment.source
      const attemptsContainer = $('<div class="number-of-attempts-container codio-fieldset" />')
      attemptsContainer.append('<label for="attemptsDefined">Defined number of attempts</label>')
      const attemptsInput = $(
        `<input id='attemptsDefined' type='checkbox' ${maxAttemptsCount ? 'checked' : ''} />`
      )
      attemptsContainer.append(attemptsInput)
      container.append(attemptsContainer)

      const numAttemptContainer = $(
        `<div class="num-defined-attempts-container codio-fieldset ${!maxAttemptsCount ? 'hide' : ''}" />`)
      numAttemptContainer.append('<label for="numDefinedAttempts">Number of attempts</label>')
      const inputVal = isNaN(maxAttemptsCount) ? 1 : maxAttemptsCount
      const numAttemptsInput = $(
        `<input id="numDefinedAttempts" type="number" min="1" max="100" value="${inputVal}" />`
      )
      numAttemptContainer.append(numAttemptsInput)
      container.append(numAttemptContainer)
      attemptsInput.on('change', function () {
        this.checked ? numAttemptContainer.removeClass('hide') : numAttemptContainer.addClass('hide')
      })
    },
    collectAttempts: (container) => {
      const attemptsContainer = container.find('.number-of-attempts-container')
      const attemptsDefined = attemptsContainer.find('#attemptsDefined').is(':checked')
      const numAttemptsContainer = $('.num-defined-attempts-container')
      const numAttemptsVal = numAttemptsContainer.find('#numDefinedAttempts').val()
      const maxAttemptsCount = attemptsDefined ? parseInt(numAttemptsVal, 10) : 0

      let error = ''
      if (attemptsDefined && (isNaN(maxAttemptsCount) || maxAttemptsCount < 1 || maxAttemptsCount > 100)) {
        error = 'Correct number of attempts should be greater than 0 and less than 100'
      }
      return {maxAttemptsCount, error}
    },
    renderRationale: (container, assessment) => {
      const {showGuidanceAfterResponseOption, guidance} = assessment.source
      const {type, passedFrom} = showGuidanceAfterResponseOption
      const rationaleContainer = $('<div class="rationale-container codio-fieldset" />')
      const addRadio = (value, label) => {
        const name = 'showGuidanceAfterResponseOption'
        const input =$(
          `<input type="radio" id="id_${value}" name="${name}" ${type === value ? 'checked' : ''} value="${value}" />`
        )
        const div = $('<div />')
        div.append(input)
        div.append(`<label class="radio-label" for="id_${value}">${label}</label>`)
        rationaleContainer.append(div)
        return input
      }
      const addRadioInnerField = (dependsOn, id, label, value) => {
        const isChecked = dependsOn.is(':checked')
        const container =
          $(`<div class="rationale-inner-radio-container codio-fieldset ${!isChecked ? 'hide' : ''}" />`)
        container.append(`<label for="${id}">${label}</label>`)
        const input = $(`<input id='${id}' type='number' min='0' max='100' value='${value}' />`)
        container.append(input)
        rationaleContainer.append(container)
        return container
      }
      rationaleContainer.append('<p>Show rationale to student</p>')
      addRadio('Never', 'Never')
      const afterAttemptsInput = addRadio('Attempts', 'After ... attempts')
      const attempts = type === 'Attempts' && passedFrom ? passedFrom : 1
      const afterAttemptsCount = addRadioInnerField(afterAttemptsInput, 'afterAttemptsCount', 'Attempts', attempts)
      const ghThenInput = addRadio('Score', 'Score greater that or equal to ... %')
      const percent = type === 'Score' && passedFrom ? passedFrom : 60
      const gtThenPercent = addRadioInnerField(ghThenInput, 'gtThenPercent', 'Percent', percent)
      addRadio('Always', 'Always')
      rationaleContainer.find('input[name="showGuidanceAfterResponseOption"]').on('change', function () {
        switch (this.value) {
          case afterAttemptsInput.val():
            afterAttemptsCount.removeClass('hide')
            gtThenPercent.addClass('hide')
            break
          case ghThenInput.val():
            gtThenPercent.removeClass('hide')
            afterAttemptsCount.addClass('hide')
            break
          default:
            afterAttemptsCount.addClass('hide')
            gtThenPercent.addClass('hide')
        }
      })
      container.append(rationaleContainer)
      const guidanceContainer =$('<div class="guidance-container codio-fieldset" />')
      guidanceContainer.append('<label for="guidance">Rationale</label>')
      const ta = $(`<textarea id='guidance' rows="4">${guidance || ''}</textarea>`)
      guidanceContainer.append(ta)
      container.append(guidanceContainer)
    },
    collectRationale: (container) => {
      const rationaleContainer = container.find('.rationale-container')
      const guidanceType = rationaleContainer.find('[name="showGuidanceAfterResponseOption"]:checked').val()
      const showGuidanceAfterResponseOption = {type: guidanceType}
      switch (guidanceType) {
        case 'Score': {
          showGuidanceAfterResponseOption.passedFrom = parseInt(rationaleContainer.find('#gtThenPercent').val(), 10)
          break
        }
        case 'Attempts': {
          showGuidanceAfterResponseOption.passedFrom =
            parseInt(rationaleContainer.find('#afterAttemptsCount').val(), 10)
          break
        }
      }
      const guidanceContainer = container.find('.guidance-container')
      return {
        guidance: guidanceContainer.find('#guidance').val(),
        showGuidanceAfterResponseOption
      }
    }
  }
}()
