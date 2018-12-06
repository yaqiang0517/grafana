import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { variableTypes } from './variable';
import appEvents from 'app/core/app_events';

export class VariableEditorCtrl {
  /** @ngInject */
  constructor($scope, datasourceSrv, variableSrv, templateSrv) {
    $scope.variableTypes = variableTypes;
    $scope.ctrl = {};
    $scope.namePattern = /^(?!__).*$/;
    $scope._ = _;
    $scope.optionsLimit = 20;

    $scope.refreshOptions = [
      { value: 0, text: '从不' },
      { value: 1, text: '仪表盘加载时' },
      { value: 2, text: '时间范围变更时' },
    ];

    $scope.sortOptions = [
      { value: 0, text: '不可用' },
      { value: 1, text: '按字母顺序排列（顺序）' },
      { value: 2, text: '按字母顺序排列（倒序）' },
      { value: 3, text: '按数字排序（顺序）' },
      { value: 4, text: '按数字排序（倒序）' },
      { value: 5, text: '按字母顺序排列（不区分大小写，顺序）' },
      { value: 6, text: '按字母顺序排列（不区分大小写，倒序）' },
    ];

    $scope.hideOptions = [{ value: 0, text: '' }, { value: 1, text: 'Label' }, { value: 2, text: 'Variable' }];

    $scope.init = () => {
      $scope.mode = 'list';

      $scope.variables = variableSrv.variables;
      $scope.reset();

      $scope.$watch('mode', val => {
        if (val === 'new') {
          $scope.reset();
        }
      });
    };

    $scope.setMode = mode => {
      $scope.mode = mode;
    };

    $scope.add = () => {
      if ($scope.isValid()) {
        variableSrv.addVariable($scope.current);
        $scope.update();
      }
    };

    $scope.isValid = () => {
      if (!$scope.ctrl.form.$valid) {
        return false;
      }

      if (!$scope.current.name.match(/^\w+$/)) {
        appEvents.emit('alert-warning', ['Validation', '变量名中只允许使用单词和数字字符']);
        return false;
      }

      const sameName = _.find($scope.variables, { name: $scope.current.name });
      if (sameName && sameName !== $scope.current) {
        appEvents.emit('alert-warning', ['Validation', '已存在具有相同名称的变量']);
        return false;
      }

      if (
        $scope.current.type === 'query' &&
        _.isString($scope.current.query) &&
        $scope.current.query.match(new RegExp('\\$' + $scope.current.name + '(/| |$)'))
      ) {
        appEvents.emit('alert-warning', [
          'Validation',
          '查询不能包含对自身的引用. 变量: $' + $scope.current.name,
        ]);
        return false;
      }

      return true;
    };

    $scope.validate = () => {
      $scope.infoText = '';
      if ($scope.current.type === 'adhoc' && $scope.current.datasource !== null) {
        $scope.infoText = 'Adhoc过滤器会自动应用于所有以此数据源为目标的查询';
        datasourceSrv.get($scope.current.datasource).then(ds => {
          if (!ds.getTagKeys) {
            $scope.infoText = '此数据源尚不支持adhoc过滤器。';
          }
        });
      }
    };

    $scope.runQuery = () => {
      $scope.optionsLimit = 20;
      return variableSrv.updateOptions($scope.current).catch(err => {
        if (err.data && err.data.message) {
          err.message = err.data.message;
        }
        appEvents.emit('alert-error', ['模板：', '无法初始化模板变量： ' + err.message]);
      });
    };

    $scope.onQueryChange = (query, definition) => {
      $scope.current.query = query;
      $scope.current.definition = definition;
      $scope.runQuery();
    };

    $scope.edit = variable => {
      $scope.current = variable;
      $scope.currentIsNew = false;
      $scope.mode = 'edit';
      $scope.validate();
      datasourceSrv.get($scope.current.datasource).then(ds => {
        $scope.currentDatasource = ds;
      });
    };

    $scope.duplicate = variable => {
      const clone = _.cloneDeep(variable.getSaveModel());
      $scope.current = variableSrv.createVariableFromModel(clone);
      $scope.current.name = 'copy_of_' + variable.name;
      variableSrv.addVariable($scope.current);
    };

    $scope.update = () => {
      if ($scope.isValid()) {
        $scope.runQuery().then(() => {
          $scope.reset();
          $scope.mode = 'list';
          templateSrv.updateTemplateData();
        });
      }
    };

    $scope.reset = () => {
      $scope.currentIsNew = true;
      $scope.current = variableSrv.createVariableFromModel({ type: 'query' });

      // this is done here in case a new data source type variable was added
      $scope.datasources = _.filter(datasourceSrv.getMetricSources(), ds => {
        return !ds.meta.mixed && ds.value !== null;
      });

      $scope.datasourceTypes = _($scope.datasources)
        .uniqBy('meta.id')
        .map(ds => {
          return { text: ds.meta.name, value: ds.meta.id };
        })
        .value();
    };

    $scope.typeChanged = function() {
      const old = $scope.current;
      $scope.current = variableSrv.createVariableFromModel({
        type: $scope.current.type,
      });
      $scope.current.name = old.name;
      $scope.current.hide = old.hide;
      $scope.current.label = old.label;

      const oldIndex = _.indexOf(this.variables, old);
      if (oldIndex !== -1) {
        this.variables[oldIndex] = $scope.current;
      }

      $scope.validate();
    };

    $scope.removeVariable = variable => {
      variableSrv.removeVariable(variable);
    };

    $scope.showMoreOptions = () => {
      $scope.optionsLimit += 20;
    };

    $scope.datasourceChanged = async () => {
      datasourceSrv.get($scope.current.datasource).then(ds => {
        $scope.current.query = '';
        $scope.currentDatasource = ds;
      });
    };
  }
}

coreModule.controller('VariableEditorCtrl', VariableEditorCtrl);
