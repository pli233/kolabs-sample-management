Feature: UX-8 Restored results are marked as a prior run

  Scenario: A result restored after navigation is flagged, fresh runs are not
    Given I am on the "Aliquot Finder" page
    And the aliquot finder returns two picks
    When I fill "IDs" with "1"
    And I click "Find"
    Then I should not see "Showing your last run"
    When I navigate to "QC Sampler" via the sidebar
    And I navigate to "Aliquot Finder" via the sidebar
    Then I should see "Showing your last run"
    When I fill "IDs" with "2"
    And I click "Find"
    Then I should not see "Showing your last run"
