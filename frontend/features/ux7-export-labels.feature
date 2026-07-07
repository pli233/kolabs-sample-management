Feature: UX-7 Export controls are labeled

  Scenario: Pick and full exports are distinct, named buttons
    Given I am on the "Aliquot Finder" page
    And the aliquot finder returns two picks
    When I fill "IDs" with "1"
    And I click "Find"
    Then the "Export picks" button is visible
    And the "Export all rows" button is visible
