/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0.
 */

import { mqtt, auth, http, io, iot } from 'aws-iot-device-sdk-v2';
import { TextDecoder } from 'util';

type Args = { [index: string]: any };

const yargs = require('yargs');
yargs.command('*', false, (yargs: any) => {
    yargs
        .option('endpoint', {
            alias: 'e',
            description: "a269y8yihw1shl-ats.iot.eu-central-1.amazonaws.com. ",
            type: 'string',
            required: true
        })
        .option('ca_file', {
            alias: 'r',
            description: 'C:\Users\corbetta.marco\Desktop\certs\CA-root.pem',
            type: 'string',
            required: false
        })
        .option('cert', {
            alias: 'c',
            description: 'C:\Users\corbetta.marco\Desktop\certs\primary-certificate.pem',
            type: 'string',
            required: false
        })
        .option('key', {
            alias: 'k',
            description: 'C:\Users\corbetta.marco\Desktop\certs\private_key.key',
            type: 'string',
            required: false
        })
        .option('client_id', {
            alias: 'C',
            description: 'a269y8yihw1shl-ats.iot.eu-central-1.amazonaws.com',
            type: 'string',
            required: false
        })
        .option('topic', {
            alias: 't',
            description: 'STRING: Targeted topic',
            type: 'string',
            default: 'test/topic'
        })
        .option('count', {
            alias: 'n',
            default: 10,
            description: '10 ' ,
            type: 'number',
            required: false
        })
        .option('use_websocket', {
            alias: 'W',
            default: false,
            description: 'To use a websocket instead of raw mqtt. If you ' +
            'specify this option you must specify a region for signing, you can also enable proxy mode.',
            type: 'boolean',
            required: false
        })
        .option('signing_region', {
            alias: 's',
            default: 'us-east-1',
            description: 'If you specify --use_websocket, this ' +
            'is the region that will be used for computing the Sigv4 signature',
            type: 'string',
            required: false
        })
        .option('proxy_host', {
            alias: 'H',
            description: 'Hostname for proxy to connect to. Note: if you use this feature, ' +
            'you will likely need to set --ca_file to the ca for your proxy.',
            type: 'string',
            required: false
        })
        .option('proxy_port', {
            alias: 'P',
            default: 8080,
            description: 'Port for proxy to connect to.',
            type: 'number',
            required: false
        })
        .option('message', {
            alias: 'M',
            description: 'Message to publish.',
            type: 'string',
            default: 'Ciao mondo!'
        })
        .option('verbosity', {
            alias: 'v',
            description: 'BOOLEAN: Verbose output',
            type: 'string',
            default: 'none',
            choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'none']
        })
        .help()
        .alias('help', 'h')
        .showHelpOnFail(false)
}, main).parse();

async function execute_session(connection: mqtt.MqttClientConnection, argv: Args) {
    return new Promise(async (resolve, reject) => {
        try {
            const decoder = new TextDecoder('utf8');
            const on_publish = async (topic: string, payload: ArrayBuffer) => {
                const json = decoder.decode(payload);
                console.log(`Publish received on topic ${topic}`);
                console.log(json);
                const message = JSON.parse(json);
                if (message.sequence == argv.count) {
                    resolve();
                }
            }

            await connection.subscribe(argv.topic, mqtt.QoS.AtLeastOnce, on_publish);

            for (let op_idx = 0; op_idx < argv.count; ++op_idx) {
                const publish = async () => {
                    const msg = {
                        message: argv.message,
                        sequence: op_idx + 1,
                    };
                    const json = JSON.stringify(msg);
                    connection.publish(argv.topic, json, mqtt.QoS.AtLeastOnce);
                }
                setTimeout(publish, op_idx * 1000);
            }
        }
        catch (error) {
            reject(error);
        }
    });
}

async function main(argv: Args) {
    if (argv.verbosity != 'none') {
        const level : io.LogLevel = parseInt(io.LogLevel[argv.verbosity.toUpperCase()]);
        io.enable_logging(level);
    }

    const client_bootstrap = new io.ClientBootstrap();

    let config_builder = null;
    if(argv.use_websocket) {
        let proxy_options = undefined;
        if (argv.proxy_host) {
            proxy_options = new http.HttpProxyOptions(argv.proxy_host, argv.proxy_port);
        }

        config_builder = iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
            region: argv.signing_region,
            credentials_provider: auth.AwsCredentialsProvider.newDefault(client_bootstrap),
            proxy_options: proxy_options
        });
    } else {
        config_builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(argv.cert, argv.key);
    }

    if (argv.ca_file != null) {
        config_builder.with_certificate_authority_from_path(undefined, argv.ca_file);
    }

    config_builder.with_clean_session(false);
    config_builder.with_client_id(argv.client_id || "test-" + Math.floor(Math.random() * 100000000));
    config_builder.with_endpoint(argv.endpoint);

    // force node to wait 60 seconds before killing itself, promises do not keep node alive
    const timer = setTimeout(() => {}, 60 * 1000);

    const config = config_builder.build();
    const client = new mqtt.MqttClient(client_bootstrap);
    const connection = client.new_connection(config);

    await connection.connect()
    await execute_session(connection, argv)

    // Allow node to die if the promise above resolved
    clearTimeout(timer);
}
