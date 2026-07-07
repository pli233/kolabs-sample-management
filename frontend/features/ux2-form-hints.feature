Feature: UX-2 Tool forms say why the action is disabled

  Scenario: Aliquot Finder explains the disabled Find button
    Given I am on the "Aliquot Finder" page
    Then the "Find" button is disabled
    And I should see "Enter at least one ID to search"
    When I fill "IDs" with "425280"
    Then the "Find" button is enabled
    And I should not see "Enter at least one ID to search"

  Scenario: QC Sampler names the missing fields
    Given I am on the "QC Sampler" page
    Then the "Sample" button is disabled
    And I should see "Enter a project and box range"
