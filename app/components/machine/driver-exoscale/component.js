import Ember from 'ember';
import Driver from 'ui/mixins/driver';
import { ajaxPromise } from 'ember-api-store/utils/ajax-promise';

let RANCHER_GROUP         = 'rancher-machine';
let RANCHER_INGRESS_RULES = [
  {
    startport: 22,
    endport: 22,
    cidrlist: '0.0.0.0/0',
    protocol: 'TCP'
  },
  {
    startport: 2376,
    endport: 2376,
    cidrlist: '0.0.0.0/0',
    protocol: 'TCP'
  },
  {
    startport: 500,
    endport: 500,
    cidrlist: '0.0.0.0/0',
    protocol: 'UDP'
  },
  {
    startport: 4500,
    endport: 4500,
    cidrlist: '0.0.0.0/0',
    protocol: 'UDP'
  },
  {
    icmptype: 8,
    icmpcode: 0,
    cidrlist: '0.0.0.0/0',
    protocol: 'ICMP'
  }
];

export default Ember.Component.extend(Driver, {
  driverName               : 'exoscale',
  model                    : null,
  exoscaleConfig           : Ember.computed.alias('model.exoscaleConfig'),

  allInstanceProfiles      : null,
  allTemplates             : null,

  allZones                 : null,
  selectedZone             : null,
  defaultZone              : 'ch-dk-2',
  whichZone                : '91e5e9e4-c9ed-4b76-bee4-427004b3baf9',
  allSecurityGroups        : null,
  selectedSecurityGroup    : null,
  defaultSecurityGroup     : null,
  defaultSecurityGroupName : RANCHER_GROUP,
  whichSecurityGroup       : 'default',
  isCustomSecurityGroup    : Ember.computed.equal('whichSecurityGroup','custom'),
  exoscaleApi              : 'api.exoscale.ch/compute',

  step                     : 1,
  isStep1                  : Ember.computed.equal('step',1),
  isStep2                  : Ember.computed.equal('step',2),
  isStep3                  : Ember.computed.equal('step',3),
  isStep4                  : Ember.computed.equal('step',4),
  isStep5                  : Ember.computed.equal('step',5),
  isStep6                  : Ember.computed.equal('step',6),
  isStep7                  : Ember.computed.equal('step',7),
  isStep8                  : Ember.computed.equal('step',8),
  isGteStep3               : Ember.computed.gte('step',3),
  isGteStep4               : Ember.computed.gte('step',4),
  isGteStep5               : Ember.computed.gte('step',5),
  isGteStep6               : Ember.computed.gte('step',6),
  isGteStep7               : Ember.computed.gte('step',7),
  isGteStep8               : Ember.computed.gte('step',8),

  bootstrap: function() {
    let config = this.get('store').createRecord({
      type: 'exoscaleConfig',
      apiKey: '',
      apiSecretKey: '',
      diskSize: 50,
      template: 'Linux Ubuntu 14.04 LTS 64-bit',
      instanceProfile: 'Medium',
      securityGroup: 'rancher-machine',
    });

    this.set('model', this.get('store').createRecord({
      type: 'host',
      exoscaleConfig: config
    }));
  },

  afterInit: function() {
    this._super();

    let cur = this.get('exoscaleConfig.securityGroup');
    if (cur === RANCHER_GROUP) {
      this.setProperties({
        whichSecurityGroup: 'default',
        selectedSecurityGroup: null
      });
    } else {
      this.setProperties({
        whichSecurityGroup: 'custom',
        selectedSecurityGroup: cur
      });
    }
  }.on('init'),

  willDestroyElement() {
    this.set('errors', null);
    this.set('step', 1);
  },

  actions: {
    /* Login step */
    exoscaleLogin: function() {
      this.set('errors', null);
      this.set('step', 2);

      this.set('exoscaleConfig.apiKey', (this.get('exoscaleConfig.apiKey')||'').trim());
      this.set('exoscaleConfig.apiSecretKey', (this.get('exoscaleConfig.apiSecretKey')||'').trim());


      this.apiRequest('listZones').then((res) => {
        let zones = [];
        let defaultZone = null;

        (res.listzonesresponse.zone || []).forEach((zone) => {
          let obj = {
            id : zone.id,
            name : zone.name,
            isDefault : zone.name === this.get('defaultZone'),
          };

          zones.push(obj);
          if (zone.isDefault && !defaultZone) {
            defaultZone = obj;
          }
        });

        this.set('step', 3);
        this.set('allZones', zones);
        this.set('defaultZone', defaultZone);
        this.set('selectedZone', this.get('exoscaleConfig.zone') || this.get('allZones.firstObject.id'));
      }, (err) => {
        let errors = this.get('errors') || [];
        errors.pushObject(this.apiErrorMessage(
            err,
            'listzonesresponse',
            'While requesting zones',
            'Authentication failure: please check the provided access credentials'
        ));
          this.set('errors', errors);
          this.set('step', 1);
      });
    },

    /* Zone selection */
    selectZone: function() {
      this.set('errors',null);

      this.set('exoscaleConfig.zone', this.get('selectedZone'));
      (this.get('allZones') || []).forEach((zone) => {
        if (zone.id === this.get('selectedZone')) {
          this.set('exoscaleConfig.zoneName', zone.name);
        }
      });

      this.set('step', 4);
      this.apiRequest('listSecurityGroups').then((res) => {
        let groups       = [];
        let defaultGroup = null;

        // Retrieve the list of security groups.
        (res.listsecuritygroupsresponse.securitygroup || [])
          .forEach((group) => {
            let obj = {
              id          : group.id,
              name        : group.name,
              description : group.description,
              isDefault   : group.name === this.get('defaultSecurityGroupName')
            };

            groups.push(obj);
            if (obj.isDefault && !defaultGroup) {
              defaultGroup = obj;
            }
          });

        // Move to next step
        this.set('step', 5);
        this.set('allSecurityGroups', groups);
        this.set('defaultSecurityGroup', defaultGroup);
        this.set('selectedSecurityGroup', this.get('exoscaleConfig.securityGroup') || this.get('allSecurityGroups.firstObject.id'));
      }, (err) => {
        let errors = this.get('errors')||[];
        errors.pushObject(this.apiErrorMessage(err,
                                               'listsecuritygroupsresponse',
                                               'While requesting security groups',
                                               'Authentication failure: please check the provided access credentials'));
        this.set('errors', errors);
        this.set('step', 3);
      });
    },

    /* Security group selection */
    selectSecurityGroup: function() {
      this.set('errors',null);

      /* When selecting a custom security group, we don't have to do anything more */
      if (this.get('isCustomSecurityGroup')) {
        this.set('exoscaleConfig.securityGroup', this.get('selectedSecurityGroup'));
        this.fetchInstanceSettings();
        return;
      }

      /* Otherwise, do we need to create the default security group? */
      this.set('exoscaleConfig.securityGroup', this.get('defaultSecurityGroupName'));
      let group = this.get('defaultSecurityGroup');
      if (group) {
        /* Already exists, we assume that it contains the appropriate rules */
        this.set('exoscaleConfig.securityGroup', group.name);
        this.fetchInstanceSettings();
        return;
      }

      /* We need to create the security group */
      this.set('step', 6);
      this.apiRequest('createSecurityGroup', {
        name        : this.get('defaultSecurityGroupName'),
        description : this.get('settings.appName') + ' default security group'
      }).then((res) => {
        return async.eachSeries(RANCHER_INGRESS_RULES, (item, cb) => {
          item.securitygroupid = res.createsecuritygroupresponse.securitygroup.id;
          this.apiRequest('authorizeSecurityGroupIngress', item)
            .then(() => {
              return cb();
            }, (err) => {
              return cb(err);
            });
        }, (err) => {
          if (err) {
            let errors = this.get('errors')||[];
            errors.pushObject(this.apiErrorMessage(err,
                                                   'authorizesecuritygroupingressresponse',
                                                   'While setting default security group',
                                                   'Unable to configure the default security group'));
            this.set('errors', errors);
            this.set('step', 5);
          } else {
            this.fetchInstanceSettings();
          }
        });
      }, (err) => {
          let errors = this.get('errors')||[];
          errors.pushObject(this.apiErrorMessage(err,
                                                 'createsecuritygroupresponse',
                                                 'While creating default security group',
                                                 'Unable to create the default security group'));
          this.set('errors', errors);
          this.set('step', 5);
      });
    }
  },

  fetchInstanceSettings: function() {
    this.set('step', 7);

    /* First, get a list of templates to get available disk sizes */
    this.apiRequest('listTemplates', {
      templatefilter : 'featured',
      zoneid         : this.get('exoscaleConfig.zone')
    }).then((res) => {
      this.set('allTemplates',
               res.listtemplatesresponse.template
                 .filter((item) => item.name.startsWith('Linux'))
                 .map((item) => item.name)
                 .sort()
                 .uniq());
      /* Also get the instance types */
      return this.apiRequest('listServiceOfferings', {
        issystem: 'false'
      }).then((res) => {
        this.set('allInstanceProfiles',
                 res.listserviceofferingsresponse.serviceoffering
                   .sort((a, b) => {
                     if (a.memory < b.memory) {
                       return -1;
                     }
                     if (b.memory < a.memory) {
                       return 1;
                     }
                     return 0;
                   })
                   .map((item) => ({ name: item.name, displaytext: item.displaytext })));
        this.set('step', 8);
      }, (err) => {
        let errors = this.get('errors')||[];
        errors.pushObject(this.apiErrorMessage(err,
                                               'listserviceofferingsresponse',
                                             'While getting list of instance types',
                                             'Unable to get list of instance types'));
        this.set('errors', errors);
        this.set('step', 5);
      });
    }, (err) => {
      let errors = this.get('errors')||[];
      errors.pushObject(this.apiErrorMessage(err,
                                             'listtemplatesresponse',
                                             'While getting list of available images',
                                             'Unable to get list of available images'));
      this.set('errors', errors);
      this.set('step', 5);
    });
  },

  apiErrorMessage: function(err, kind, prefix, def) {
    let answer = (err.xhr || {}).responseJSON || {};
    let text   = (answer[kind] || {}).errortext;
    if (text) {
      return prefix + ": " + text;
    } else {
      return def;
    }
  },

  apiRequest: function(command, params) {
    let url         = this.get('app.proxyEndpoint') + '/' + this.exoscaleApi;
    params          = params || {};
    params.command  = command;
    params.apiKey   = this.get('exoscaleConfig.apiKey');
    params.response = 'json';

    return ajaxPromise({url: url,
                        method: 'POST',
                        dataType: 'json',
                        headers: {
                          'Accept': 'application/json',
                          'X-API-Headers-Restrict': 'Content-Length'
                        },
                        beforeSend: (xhr, settings) => {
                          // Append 'rancher:' to Content-Type
                          xhr.setRequestHeader('Content-Type',
                                               'rancher:' + settings.contentType);

                          // Compute the signature
                          let qs = settings.data.split('&')
                                .map((q) => q.replace(/\+/g, '%20'))
                                .map(Function.prototype.call, String.prototype.toLowerCase)
                                .sort()
                                .join('&');
                          settings.data += '&signature=' + encodeURIComponent(AWS.util.crypto.hmac(
                            this.get('exoscaleConfig.apiSecretKey'), qs, 'base64', 'sha1'));
                          return true;
                        },
                        data: params}, true);
  },

});
