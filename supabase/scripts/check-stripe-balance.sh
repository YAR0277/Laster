stripe_driver_balance() {
    local account_id="acct_1UeIbvRugg2tJTgl"
    local key="${STRIPE_SECRET_KEY:-}"

    if [[ -z "$key" ]]; then
        read -rsp "Stripe secret key: " key
        echo
    fi

    local response
    response=$(curl -fsS \
        https://api.stripe.com/v1/balance \
        -u "$key:" \
        -H "Stripe-Account: $account_id") || {
            echo "Stripe balance request failed."
            unset key
            return 1
        }

    unset key

    echo "$response" | jq -r '
      def usd_total($field):
        [($field // [])[] | select(.currency == "usd") | .amount]
        | add // 0;

      "Mode: " + (if .livemode then "LIVE" else "TEST" end),
      "Available: " + (usd_total(.available) / 100 | tostring),
      "Instant available: " + (usd_total(.instant_available) / 100 | tostring),
      "Pending: " + (usd_total(.pending) / 100 | tostring)
    '
}

stripe_driver_balance