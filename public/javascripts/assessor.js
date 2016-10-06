function populateList(dataset, controlName) {
    $('#' + controlName).empty();

    $.ajax({
      type: "GET",
      url: "/dataservices/" + dataset,
      success: function(data) {
        data.values.forEach(function(value){
            $('#' + controlName).append($("<option />").val(value).text(value));
        });
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
}

function enableFormInputs() {
    // Adjustor form
    $("#adjustor-select").prop('disabled', false);
    $("#submit-adjustor").prop('disabled', false);

    // Payee buttons
    $("#optionsBank").prop('disabled', false);
    $("#optionsPolicyHolder").prop('disabled', false);
    $("#optionsRepairFacility").prop('disabled', false);
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


$(document).ready(function () {
    var claim = null;

    // Disable the adjustors and payee inputs until we have looked up a policy
    $("#policy").keypress(function() {
        disableFormInputs();
    });

    // Fill in the list of adjustors
    populateList('adjustors', 'adjustor-select');


    // When the radio button is selected populate the payee list
    $("input[name=optionsRadios]:radio").change(function () {
        switch($(this).val()) {
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
    })


    $("#submit-payee").click( function(){
        var customer = $("#policy").val();
        var payee = $('#payee-select :selected').text();
        var type = $("input[name=optionsRadios]:checked").val();
        var role = 'Unknown';
        var state = "Paid";

        switch(type) {
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

        BlockChain.setOwner(customer, payee, role, state);
    });

    $("#submit-adjustor").click( function(){
        var customer = $("#policy").val();
        var adjustor = $('#adjustor-select :selected').text();
        BlockChain.setOwner(customer, adjustor, "Adjustor", "In Process");
    });


    // Lookup policy button clicked
    $("#submit-policy").click( function(){
        var customer = $("#policy").val();

        // Setup the callback that is invoked when a policy is found.
        var policyResponsePayloadSetter = Policy.setResponsePayload;

        Policy.setResponsePayload = function(data) {
            policyResponsePayloadSetter.call(Policy, data);
            claim = data;

            $("#reason").val(data.claimReason);
            $("#vehicle").val(data.vehicle);

            // Localize the display of the currency
            if(typeof Intl != "undefined") {
                var formattedValue = new Intl.NumberFormat('default',
                    { style: 'currency', currency: 'USD' }).format(new Number(data.totalClaimAmount));
                $("#amount").val(formattedValue);
            }
            else {
                $("#amount").val(data.totalClaimAmount);
            }

            // Get the block chain entry for this claim
            BlockChain.getClaim(customer);
        };


        // Listen for when the history data for the claim has been loaded
        var historyBlockChainPayloadSetter = BlockChain.setHistoryPayload;

        BlockChain.setHistoryPayload = function(data) {
            historyBlockChainPayloadSetter.call(BlockChain, data);
            console.log("HISTORY: " + JSON.stringify(data));
            // show the history
            //$('#history-table > tbody:last').append('<tr><td>column 1 value</td><td>column 2 value</td></tr>');
        };


        // Listen for when the Block Chain is available for the claim
        var policyBlockChainPayloadSetter = BlockChain.setResponsePayload;

        BlockChain.setResponsePayload = function(data) {
            policyBlockChainPayloadSetter.call(BlockChain, data);

            // There is no block chain entry for this claim so create a new one
            if ($.isEmptyObject(data)) {
                console.log("No block chain entry for this claim: " + claim.customer);
                var block = {
                    customer: claim.customer,
                    amount: claim.totalClaimAmount,
                    vehicle: claim.vehicle,
                    owner: 'Acme Insurance',
                    role: 'Claim Recipient',
                    state: "Received"
                };
                // Store the claim for this policy in the blockchain
                BlockChain.setClaim(block);
                $("#assignment").val(block.owner);
            }
            else {
                $("#assignment").val(data.owner);
            }

            // Get the history of this claim
            BlockChain.getHistory(claim.customer);

            // We have the claim loaded so now enable the other forms
            enableFormInputs();
        };

        // Get the policy and claim for this customer
        Policy.getPolicy(customer, 'en');
    });

});