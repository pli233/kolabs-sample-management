Feature: UX-1 Plate Map paste tells you how it was read

  Scenario: Position + label pairs are scattered to their wells
    Given I am on the "Plate Map" page
    When I paste into the first sample cell:
      """
      A01	Alpha
      B02	Bravo
      """
    Then I should see "position + label" within 300ms
    And 2 of 96 wells are filled

  Scenario: Bare labels fill consecutively in order
    Given I am on the "Plate Map" page
    When I paste into the first sample cell:
      """
      Alpha
      Bravo
      Charlie
      """
    Then I should see "in order" within 300ms
    And 3 of 96 wells are filled

  Scenario: An unreadable paste changes nothing and warns
    Given I am on the "Plate Map" page
    When I paste into the first sample cell:
      """
      Sample_Info	Box
      Position	Samples
      """
    Then I should see "Couldn't read that paste" within 300ms
    And 0 of 96 wells are filled
