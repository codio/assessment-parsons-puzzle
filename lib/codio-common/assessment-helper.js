window.codioAssessmentHelper = function () {
  return {
    addStyle: (() => {
      const style = document.createElement('style');
      document.head.append(style);
      return (styleString) => style.textContent = styleString;
    })(),
    calculateGuidance: (
      authoringMode,
      showAsTeacher,
      answered,
      {showGuidanceAfterResponseOption, guidance, points},
      {answerGuidance, answerPoints, attemptsCount, passed}
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
        }
        return showAsTeacher || answered && showGuidanceAfterResponse ? guidance : ''
      }
      return showAsTeacher ? guidance : (answered ? answerGuidance : '')
    }
  }
}()
