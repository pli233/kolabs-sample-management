Feature: UX-5 In-flight requests show a skeleton, not a blank

  Scenario: The results area shows a loading placeholder while finding
    Given I am on the "Aliquot Finder" page
    And the "aliquot finder" request is slow
    When I fill "IDs" with "425280"
    And I click "Find"
    Then the loading placeholder is shown
    And the loading placeholder is gone
