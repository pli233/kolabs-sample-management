Feature: UX-6 Clear is confirmable and undoable

  Scenario: Clear asks first, and can be undone
    Given I am on the "Plate Map" page
    When I paste into the first sample cell:
      """
      Alpha
      Bravo
      """
    Then 2 of 96 wells are filled
    When I click "Clear"
    Then I should see "Clear all 2 wells?"
    When I click "Cancel"
    Then 2 of 96 wells are filled
    When I click "Clear"
    And I click "Clear wells"
    Then 0 of 96 wells are filled
    And I should see "Undo"
    When I click "Undo"
    Then 2 of 96 wells are filled
