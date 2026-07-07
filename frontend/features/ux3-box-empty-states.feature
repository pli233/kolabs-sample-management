Feature: UX-3 Box Lookup distinguishes "not searched" from "nothing found"

  Scenario: Before searching, a neutral hint is shown
    Given I am on the "Box Lookup" page
    Then I should see "Enter a box number to see its tubes"
    And I should not see "No tubes found"

  Scenario: A search with no hits names the box
    Given I am on the "Box Lookup" page
    And the "box lookup" request returns no rows
    When I fill "Box number" with "999"
    And I click "Look up"
    Then I should see "No tubes found for box 999"
