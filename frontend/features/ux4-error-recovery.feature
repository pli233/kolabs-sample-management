Feature: UX-4 Errors are announced and recoverable

  Scenario: A failed request shows an alert with a working Retry
    Given I am on the "Aliquot Finder" page
    And the "aliquot finder" request will fail
    When I fill "IDs" with "425280"
    And I click "Find"
    Then an alert is shown
    And I should see "Retry"
    When I click "Retry"
    Then an alert is shown
