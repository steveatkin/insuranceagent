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

function setupTable() {
    $.extend($.fn.bootstrapTable.defaults, {
        formatNoMatches: function () {
            return Resources.getResources().noHistory;
        }
    });

    $("#history-table").bootstrapTable({
        columns: [{
            field: "role",
            title: Resources.getResources().role
        }, {
            field: "owner",
            title: Resources.getResources().owner
        }, {
            field: "date",
            title: Resources.getResources().date
        }]
    });

    $("#history-table").bootstrapTable('load', []);
}


$(document).ready(function () {
    var claim = null;
    var blockLoaded = false;

    var target = document.getElementById('accordion');
    var spinner = new Spinner();

    // Disable the adjustors and payee inputs until we have looked up a policy
    $("#policy").keypress(function () {
        disableFormInputs();
        claim = null;
        blockLoaded = false;
    });

    var userLang = (navigator.language ||
                  navigator.userLanguage).substring(0,2).toLowerCase();

    // Get all the UI strings
  $.ajax({
    type: "GET",
    url: "/resources",
    data: {
      "resource":  "agent",
      "language":  userLang
    },
    success: function(data) {
      Resources.setResources(data);

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
      setupTable();
      
    },
    error: function(xhr, message) {
        alert(message);
    }
  });



    // Listen for accordion events
    $('#accordion').on('show.bs.collapse', function (e) {
        if (e.target.id === 'history' && blockLoaded) {
            spinner.spin(target);
            BlockChain.getHistory(claim.customer);
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

        spinner.spin(target);
        BlockChain.setOwner(customer, payee, role, state, function (err, message) {
            spinner.stop();
            if(err) {
                alert(message);
            }
        });
    });

    $("#submit-adjustor").click(function () {
        var customer = $("#policy").val();
        var adjustor = $('#adjustor-select :selected').text();
        spinner.spin(target);
        BlockChain.setOwner(customer, adjustor, "Adjustor", "In Process", function(err, message) {
            spinner.stop();
            if(err) {
                alert(message);
            }
        });
    });


    // Lookup policy button clicked
    $("#submit-policy").click(function () {
        var customer = $("#policy").val();

        // Setup the callback that is invoked when a policy is found.
        var policyResponsePayloadSetter = Policy.setResponsePayload;

        Policy.setResponsePayload = function (data) {
            policyResponsePayloadSetter.call(Policy, data);
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
        var historyBlockChainPayloadSetter = BlockChain.setHistoryPayload;

        BlockChain.setHistoryPayload = function (data) {
            historyBlockChainPayloadSetter.call(BlockChain, data);
            console.log("HISTORY: " + JSON.stringify(data));
            spinner.stop();
            // reset the history table
            $("#history-table").bootstrapTable('load', []);

            data.forEach(function (value) {
                $("#history-table").bootstrapTable('append', [{
                    role: value.role,
                    owner: value.owner,
                    date: (new Date(value.date)).toUTCString()
                }]);
            });
        };


        // Listen for when the Block Chain is available for the claim
        var policyBlockChainPayloadSetter = BlockChain.setResponsePayload;

        BlockChain.setResponsePayload = function (data) {
            policyBlockChainPayloadSetter.call(BlockChain, data);

            // There is no block chain entry for this claim so create a new one
            if ($.isEmptyObject(data)) {
                console.log("Creating block chain entry for this claim: " + claim.customer);
                var block = {
                    customer: claim.customer,
                    amount: claim.totalClaimAmount,
                    vehicle: claim.vehicle,
                    owner: 'Acme Insurance',
                    role: 'Claim Recipient',
                    state: "Received"
                };

                $("#assignment").val(block.owner);
                // Store the claim for this policy in the blockchain
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
        Policy.getPolicy(customer, 'en');
    });

});