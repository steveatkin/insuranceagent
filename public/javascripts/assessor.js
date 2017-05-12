/*	
 * Copyright IBM Corp. 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Steven Atkin
 */


function populateList(dataset, controlName) {
    $('#' + controlName).empty();

    $.ajax({
        type: "GET",
        url: "/dataservices/" + dataset,
        success: function (data) {
            data.values.forEach(function (value) {
                $('#' + controlName).append($("<option />").val(value).text(value));
            });
        },
        error: function (xhr, message) {
            alert(message);
        }
    });
}


function disableFormInputs() {
    // Adjustor form
    $("#adjustor-select").prop('disabled', true);
    $("#submit-adjustor").prop('disabled', true);

    // Payee buttons
    $("#optionsBank").prop('disabled', true);
    $("#optionsPolicyHolder").prop('disabled', true);
    $("#optionsRepairFacility").prop('disabled', true);

    // Payee select and button
    $("#payee-select").prop('disabled', true);
    $("#submit-payee").prop('disabled', true);
}

function createHistoryTable() {
    $.extend($.fn.bootstrapTable.defaults, {
        formatNoMatches: function () {
            return Resources.getResourcesData().noHistory;
        }
    });

    $("#history-table").bootstrapTable({
        columns: [{
            field: "role",
            title: Resources.getResourcesData().role
        }, {
            field: "owner",
            title: Resources.getResourcesData().owner
        }, {
            field: "date",
            title: Resources.getResourcesData().date
        }]
    });

    $("#history-table").bootstrapTable('load', []);
}


$(document).ready(function () {
    var claim = null;
    var blockLoaded = false;

    var userLang = (navigator.language ||
        navigator.userLanguage).substring(0, 2).toLowerCase();
    var userLocale = navigator.language || navigator.userLanguage;

    var target = document.getElementById('accordion');
    var spinner = new Spinner();

    // Disable the adjustors and payee inputs until we have looked up a policy
    $("#policy").keypress(function () {
        disableFormInputs();
        claim = null;
        blockLoaded = false;
    });

    // Get all the UI strings
    // Setup the callback that is invoked when the resources are found.
    var resourcesDataSetter = Resources.setResourcesData;

    Resources.setResourcesData = function (data) {
        resourcesDataSetter.call(Resources, data);

        $("#titleAssessor").text(data.titleAssessor);
        $("#aboutAssessor").text(data.aboutAssessor);
        $("#policy-label").text(data.policyNumber);
        $("#claim-reason-label").text(data.reason);
        $("#claim-amount-label").text(data.amount);
        $("#vehicle-label").text(data.vehicleMessage);
        $("#last-action-label").text(data.lastAction);
        $("#submit-policy").text(data.lookup);
        $("#claim-tab").text(data.claims);
        $("#adjustor-tab").text(data.adjustor);
        $("#adjustor-label").text(data.adjustorLabel);
        $("#submit-adjustor").text(data.adjustorSelect);
        $("#payee-tab").text(data.payee);
        $("#payee-type").text(data.payeeType);
        $("#payee-label").text(data.payeeLabel);
        $("#submit-payee").text(data.payeeSelect);
        $("#optionsBank").after("<label for='optionsBank'>" + data.bank + "</label>");
        $("#optionsPolicyHolder").after("<label for='optionsPolicyHolder'>" + data.policyHolder + "</label>");
        $("#optionsRepairFacility").after("<label for='optionsRepairFacility'>" + data.repair + "</label>");
        $("#history-tab").text(data.history);

        // Create the history table after we know our resources are loaded
        createHistoryTable();
    };

    // If we have Simplified or Traditional Chinese then use the full locale
    if (userLang === "zh") {
        Resources.getResources("agent", userLocale);
    } else {
        Resources.getResources("agent", userLang);
    }


    // Listen for accordion events
    $('#accordion').on('show.bs.collapse', function (e) {
        if (e.target.id === 'history' && blockLoaded) {
            spinner.spin(target);
            // We need to grab the one that is defined, some of our databases used customer while some used customerID
            var custID = claim.customer || claim.customerID
            BlockChain.getHistory(custID);
        } else if (e.target.id === 'adjustor' && blockLoaded) {
            // Adjustor form
            $("#adjustor-select").prop('disabled', false);
            $("#submit-adjustor").prop('disabled', false);
            // Fill in the list of adjustors
            populateList('adjustors', 'adjustor-select');
        } else if (e.target.id === 'payee' && blockLoaded) {
            // Payee buttons
            $("#optionsBank").prop('disabled', false);
            $("#optionsPolicyHolder").prop('disabled', false);
            $("#optionsRepairFacility").prop('disabled', false);

            // When the radio button is selected populate the payee list
            $("input[name=optionsRadios]:radio").change(function () {
                switch ($(this).val()) {
                    case 'bank':
                        // Fill in the list of banks
                        populateList('banks', 'payee-select');
                        // Enable buttons and select list
                        $("#payee-select").prop('disabled', false);
                        $("#submit-payee").prop('disabled', false);
                        break;
                    case 'repair-facility':
                        // Fill in the list of repair facilities
                        populateList('repair-facilities', 'payee-select');
                        // Enable buttons and select list
                        $("#payee-select").prop('disabled', false);
                        $("#submit-payee").prop('disabled', false);
                        break;
                    case 'policy-holder':
                        $('#payee-select').empty();
                        var name = claim.givenName + ' ' + claim.surname;
                        // Add policy holder to list and enable buttons and select list
                        $("#payee-select").append($("<option />").val(name).text(name));
                        $("#payee-select").prop('disabled', false);
                        $("#submit-payee").prop('disabled', false);
                        break;
                }
            });
        }
    });

    $("#submit-payee").click(function () {
        var customer = $("#policy").val();
        var payee = $('#payee-select :selected').text();
        var type = $("input[name=optionsRadios]:checked").val();
        var role = 'Unknown';
        var state = "Paid";

        switch (type) {
            case 'bank':
                role = "Financial Institution";
                break;
            case 'repair-facility':
                role = "Repair Facility";
                break;
            case 'policy-holder':
                role = "Policy Holder";
                break;
        };

        // Listen for when the owner change is finished
        var blockOwnerSetter = BlockChain.setOwnerState;

        BlockChain.setOwnerState = function (data) {
            blockOwnerSetter.call(BlockChain, data);
            // Change was completed stop spinner
            if (data == true) {
                spinner.stop();
            }
        };

        spinner.spin(target);
        BlockChain.setOwner(customer, payee, role, state);
    });

    $("#submit-adjustor").click(function () {
        var customer = $("#policy").val();
        var adjustor = $('#adjustor-select :selected').text();
        var state = "In Process";
        var role = "Adjustor"

        // Listen for when the owner change is finished
        var blockOwnerSetter = BlockChain.setOwnerState;

        BlockChain.setOwnerState = function (data) {
            blockOwnerSetter.call(BlockChain, data);
            // Change is complete stop spinner
            if (data == true) {
                spinner.stop();
            }
        };

        spinner.spin(target);
        BlockChain.setOwner(customer, adjustor, role, state);
    });


    // Lookup policy button clicked
    $("#submit-policy").click(function () {
        var customer = $("#policy").val();

        // Setup the callback that is invoked when a policy is found.
        var policyDataSetter = Policy.setPolicyData;

        Policy.setPolicyData = function (data) {
            policyDataSetter.call(Policy, data);
            claim = data;

            $("#reason").val(data.claimReason);
            $("#vehicle").val(data.vehicle);

            // Localize the display of the currency
            if (typeof Intl != "undefined") {
                var formattedValue = new Intl.NumberFormat('default', {
                    style: 'currency',
                    currency: 'USD'
                }).format(new Number(data.totalClaimAmount));
                $("#amount").val(formattedValue);
            } else {
                $("#amount").val(data.totalClaimAmount);
            }

            // Get the block chain entry for this claim
            spinner.spin(target);
            BlockChain.getClaim(customer);
        };


        // Listen for when the history data for the claim has been loaded
        var blockHistorySetter = BlockChain.setBlockHistory;

        BlockChain.setBlockHistory = function (data) {
            blockHistorySetter.call(BlockChain, data);
            spinner.stop();
            // reset the history table
            $("#history-table").bootstrapTable('load', []);

            data.forEach(function (value) {
                // Use the translations for each role
                if (value.role === "Claim Recipient") {
                    value.role = Resources.getResourcesData().claimRecipient;
                } else if (value.role === "Policy Holder") {
                    value.role = Resources.getResourcesData().policyHolder;
                } else if (value.role === "Repair Facility") {
                    value.role = Resources.getResourcesData().repair;
                } else if (value.role === "Financial Institution") {
                    value.role = Resources.getResourcesData().financial;
                } else if (value.role === "Adjustor") {
                    value.role = Resources.getResourcesData().adjustor;
                }

                // Localize the date
                var dateOptions = {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZone: 'UTC',
                    timeZoneName: 'short'
                };

                var dateStamp = (new Date(value.date)).toLocaleDateString(userLocale, dateOptions);

                $("#history-table").bootstrapTable('append', [{
                    role: value.role,
                    owner: value.owner,
                    date: dateStamp
                }]);
            });
        };

        // Listen for when the Block is available for the claim
        var blockDataSetter = BlockChain.setBlockData;

        BlockChain.setBlockData = function (data) {
            blockDataSetter.call(BlockChain, data);

            // There is no block entry for this claim so create a new one
            if ($.isEmptyObject(data)) {
                var block = {
                    customer: claim.customer,
                    amount: claim.totalClaimAmount,
                    vehicle: claim.vehicle,
                    owner: 'Acme Insurance',
                    role: 'Claim Recipient',
                    state: "Received"
                };

                $("#assignment").val(block.owner);
                // Store the claim for this policy in the block
                BlockChain.setClaim(block);
                blockLoaded = true;
            } else {
                // Display the current owner of the claim
                $("#assignment").val(data.owner);
                blockLoaded = true;
            }
            spinner.stop();
        };

        // Get the policy and claim for this customer
        if(userLang === 'zh') {
            Policy.getPolicy(customer, userLocale);
        }
        else {
            Policy.getPolicy(customer, userLang);
        }
    });

});